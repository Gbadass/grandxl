import type { Order } from './order.types'
import type { OrderStatus } from './enums'

export interface ChatMessage {
  _id: string
  orderId: string
  senderId: string
  senderRole: 'customer' | 'rider'
  text: string
  isRead: boolean
  readAt: string | null
  deletedAt: string | null
  createdAt: string
  tempId?: string | null // echoed back by server so sender can replace optimistic message
  // Client-side only (set by frontend, not persisted)
  status?: 'sending' | 'sent' | 'failed'
}

export interface ServerToClientEvents {
  'order:status_update': (data: {
    orderId: string
    status: OrderStatus
    eta?: string
  }) => void
  'order:new': (data: { order: Order }) => void
  'rider:location': (data: {
    riderId: string
    lat: number
    lng: number
    bearing: number
  }) => void
  'rider:new_job': (data: { order: Order }) => void
  'order:broadcast': (data: { order: Order }) => void
  'order:dispatch_update': (data: { orderId: string; phase: 'searching' | 'broadcast' | 'no_riders' }) => void
  'rider:order_ready': (data: { orderId: string }) => void
  'notification:new': (data: { message: string; type: string }) => void
  'order:rider_assigned': (data: { orderId: string; riderId: string }) => void
  'rider:approaching_restaurant': (data: { orderId: string; distanceMetres: number }) => void
  // Chat
  'chat:message': (msg: ChatMessage) => void
  'chat:peer_typing': (data: {
    orderId: string
    senderId: string
    senderRole: 'customer' | 'rider'
    isTyping: boolean
  }) => void
  'chat:messages_read': (data: {
    orderId: string
    readBy: 'customer' | 'rider'
    readAt: string
  }) => void
  'chat:message_deleted': (data: { messageId: string; orderId: string }) => void
}

export interface ClientToServerEvents {
  'rider:location_update': (data: {
    lat: number
    lng: number
    bearing: number
    orderId?: string
  }) => void
  'order:join_room': (data: { orderId: string }) => void
  'order:leave_room': (data: { orderId: string }) => void
  // Chat
  'chat:send': (
    data: { orderId: string; text: string; tempId?: string },
    ack?: (result: { ok: boolean; error?: string }) => void,
  ) => void
  'chat:typing': (data: { orderId: string; isTyping: boolean }) => void
  'chat:read': (data: { orderId: string }) => void
  'chat:delete': (
    data: { messageId: string },
    ack?: (result: { ok: boolean; error?: string }) => void,
  ) => void
}
