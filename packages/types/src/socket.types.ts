import type { Order } from './order.types'
import type { OrderStatus } from './enums'

export interface ServerToClientEvents {
  'order:status_update': (data: {
    orderId: string
    status: OrderStatus
    eta?: string
  }) => void
  'order:new': (data: { order: Order }) => void // restaurant dashboard
  'rider:location': (data: {
    riderId: string
    lat: number
    lng: number
    bearing: number
  }) => void
  'rider:new_job': (data: { order: Order }) => void // rider app — direct assignment
  'order:broadcast': (data: { order: Order }) => void // rider app — open broadcast when no nearby rider
  'order:dispatch_update': (data: { orderId: string; phase: 'searching' | 'broadcast' | 'no_riders' }) => void
  'rider:order_ready': (data: { orderId: string }) => void // rider app — food is packed, go pick it up
  'notification:new': (data: { message: string; type: string }) => void
  'order:rider_assigned': (data: { orderId: string; riderId: string }) => void
}

export interface ClientToServerEvents {
  'rider:location_update': (data: {
    lat: number
    lng: number
    bearing: number
    orderId?: string // active order — gateway uses this to target the right room
  }) => void
  'order:join_room': (data: { orderId: string }) => void
  'order:leave_room': (data: { orderId: string }) => void
}
