import { Injectable, Logger } from '@nestjs/common'
import { TrackingGateway } from './tracking.gateway'
import { type OrderStatus, OrderStatus as OS } from '@grandxl/types'

// Thin wrapper so other modules can push Socket.io events without importing the gateway directly
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name)

  constructor(private readonly gateway: TrackingGateway) {}

  notifyOrderStatusUpdate(
    orderId: string,
    customerId: string,
    restaurantId: string,
    status: OrderStatus,
    eta?: number,
  ): void {
    const payload = { orderId, status, eta }
    // Notify the customer
    this.gateway.sendToUser(customerId, 'order:status_update', payload)
    // Notify the restaurant dashboard
    this.gateway.sendToUser(restaurantId, 'order:status_update', payload)
    // Notify anyone watching the order room (e.g. admin dashboard)
    this.gateway.sendToOrderRoom(orderId, 'order:status_update', payload)
    // Clear proximity alert Sets on PICKED_UP (restaurant leg done) and on terminal
    // statuses (DELIVERED, CANCELLED) so completed order IDs don't accumulate in memory.
    if (
      status === OS.PICKED_UP ||
      status === OS.DELIVERED ||
      status === OS.CANCELLED
    ) {
      this.gateway.clearProximityAlert(orderId)
    }
  }

  notifyNewOrder(restaurantId: string, order: unknown): void {
    this.gateway.sendToUser(restaurantId, 'order:new', { order })
    // Also notify all connected super admins so they see new orders in real-time
    this.gateway.server.to('role_super_admin').emit('order:new', { order })
  }

  notifyRiderNewJob(riderId: string, order: unknown): void {
    this.gateway.sendToUser(riderId, 'rider:new_job', { order })
  }

  async broadcastOrderToRiders(riderUserIds: string[], order: unknown): Promise<void> {
    // Strip customer PII before broadcasting to unassigned candidate riders.
    // They only need enough to decide whether to accept — not the customer's
    // identity, exact address, or payment details.
    const o = order as Record<string, unknown>
    const addr = (o['deliveryAddress'] ?? {}) as Record<string, unknown>
    const pricing = (o['pricing'] ?? {}) as Record<string, unknown>
    const items = (o['items'] as unknown[]) ?? []

    const sanitized = {
      _id:                  o['_id'],
      orderNumber:          o['orderNumber'],
      restaurantId:         o['restaurantId'],
      restaurantName:       o['restaurantName'],
      restaurantPickupAddress: o['restaurantPickupAddress'],
      // Delivery neighbourhood only — no street, no GPS coordinates
      deliveryNeighbourhood: { city: addr['city'], state: addr['state'] },
      itemCount:            items.length,
      pricing: {
        deliveryFee: pricing['deliveryFee'],
        tip:         pricing['tip'],
      },
      status: o['status'],
    }

    for (const userId of riderUserIds) {
      const roomSize = await this.gateway.getRoomSize(`user_${userId}`)
      this.gateway.sendToUser(userId, 'order:broadcast', { order: sanitized })
      // roomSize=0 means the event was emitted to an empty room — rider not connected.
      this.logger.warn(`[dispatch] emitted order:broadcast to user_${userId} — ${roomSize} socket(s) in room`)
    }
  }

  notifyDispatchUpdate(customerId: string, orderId: string, phase: 'searching' | 'broadcast' | 'no_riders'): void {
    this.gateway.sendToUser(customerId, 'order:dispatch_update', { orderId, phase })
  }

  notifyRiderAssigned(
    restaurantOwnerId: string,
    customerId: string,
    payload: { orderId: string; riderId: string; riderUserId: string },
  ): void {
    this.gateway.sendToUser(restaurantOwnerId, 'order:rider_assigned', payload)
    this.gateway.sendToUser(customerId, 'order:rider_assigned', payload)
    this.gateway.sendToOrderRoom(payload.orderId, 'order:rider_assigned', payload)
  }

  notifyRiderOrderReady(riderUserId: string, orderId: string): void {
    this.gateway.sendToUser(riderUserId, 'rider:order_ready', { orderId })
  }

  broadcastRiderLocation(
    orderId: string,
    riderId: string,
    lat: number,
    lng: number,
    bearing: number,
  ): void {
    this.gateway.sendToOrderRoom(orderId, 'rider:location', { riderId, lat, lng, bearing })
  }
}
