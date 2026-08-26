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
    // statuses (DELIVERED, CANCELLED) so completed order IDs don't accumulate.
    // Refunded orders go through CANCELLED first, so no separate REFUNDED case.
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

  // Strip customer PII (phone, exact delivery address, coordinates, payment) before
  // sending an order preview to riders. Applies to both broadcast (unassigned candidates)
  // and direct rider offers — in both cases the rider has not yet picked up, so they
  // shouldn't see anything beyond what they need to decide/navigate to pickup.
  // Full delivery details are fetched from the server after PICKED_UP via gated endpoints.
  private sanitizeOrderForRider(order: unknown): Record<string, unknown> {
    const o = order as Record<string, unknown>
    const addr = (o['deliveryAddress'] ?? {}) as Record<string, unknown>
    const pricing = (o['pricing'] ?? {}) as Record<string, unknown>
    const items = (o['items'] as unknown[]) ?? []

    return {
      _id:                  o['_id'],
      orderNumber:          o['orderNumber'],
      restaurantId:         o['restaurantId'],
      restaurantName:       o['restaurantName'],
      restaurantPickupAddress: o['restaurantPickupAddress'],
      deliveryNeighbourhood: { city: addr['city'], state: addr['state'] },
      itemCount:            items.length,
      pricing: {
        deliveryFee: pricing['deliveryFee'],
        tip:         pricing['tip'],
      },
      status: o['status'],
    }
  }

  notifyRiderNewJob(riderId: string, order: unknown): void {
    // Sanitize — rider gets a job-offer preview only. Full details fetched after accept.
    this.gateway.sendToUser(riderId, 'rider:new_job', { order: this.sanitizeOrderForRider(order) })
  }

  async broadcastOrderToRiders(riderUserIds: string[], order: unknown): Promise<void> {
    const sanitized = this.sanitizeOrderForRider(order)

    for (const userId of riderUserIds) {
      const roomSize = await this.gateway.getRoomSize(`user_${userId}`)
      this.gateway.sendToUser(userId, 'order:broadcast', { order: sanitized })
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
