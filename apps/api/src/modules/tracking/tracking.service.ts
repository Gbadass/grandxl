import { Injectable } from '@nestjs/common'
import { TrackingGateway } from './tracking.gateway'
import { type OrderStatus, OrderStatus as OS } from '@grandxl/types'

// Thin wrapper so other modules can push Socket.io events without importing the gateway directly
@Injectable()
export class TrackingService {
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
    // When order is picked up, clear the proximity alert so a future re-use
    // of this orderId (unlikely but possible with re-dispatch) fires correctly.
    if (status === OS.PICKED_UP) {
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

  broadcastOrderToRiders(riderUserIds: string[], order: unknown): void {
    for (const userId of riderUserIds) {
      this.gateway.sendToUser(userId, 'order:broadcast', { order })
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
