import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { JwtService } from '@nestjs/jwt'
import { Model, Types } from 'mongoose'
import { Server, Socket } from 'socket.io'
import type { JwtPayload } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { ChatMessage } from './chat.schema'
import type { ChatMessageDocument } from './chat.schema'
import { OrdersService } from '../orders/orders.service'
import { RidersService } from '../riders/riders.service'

interface ChatSendPayload {
  orderId: string
  text: string
  tempId?: string
}

interface ChatTypingPayload {
  orderId: string
  isTyping: boolean
}

interface ChatReadPayload {
  orderId: string
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      userId: string
      roles: string[]
      // Cached after first successful send per order — avoids repeated DB lookups
      riderProfileId?: string
    }
  }
}

// Sliding-window rate limit: max RATE_LIMIT_MAX messages per RATE_LIMIT_WINDOW_MS
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX       = 20 // per user per rolling window
// Auto-stop typing broadcast if client goes silent
const TYPING_TIMEOUT_MS = 5_000

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      const allowed = new Set([
        process.env['CLIENT_URL'],
        process.env['ADMIN_URL'],
        process.env['RIDER_URL'] ?? 'http://localhost:5174',
      ].filter(Boolean) as string[])
      cb(null, !origin || allowed.has(origin))
    },
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(ChatGateway.name)

  // Rate limiting: userId → { count, windowStart }
  private readonly rateLimits = new Map<string, { count: number; windowStart: number }>()

  // Typing auto-stop timers: `${userId}_${orderId}` → timer handle
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    private readonly ordersService: OrdersService,
    private readonly ridersService: RidersService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────

  private isRateLimited(userId: string): boolean {
    const now = Date.now()
    const entry = this.rateLimits.get(userId) ?? { count: 0, windowStart: now }
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.set(userId, { count: 1, windowStart: now })
      return false
    }
    if (entry.count >= RATE_LIMIT_MAX) return true
    this.rateLimits.set(userId, { ...entry, count: entry.count + 1 })
    return false
  }

  // Resolve senderRole for a user on a given order.
  // Caches the riderProfileId on socket.data to avoid a DB hit on every message.
  private async resolveSenderRole(
    client: AuthenticatedSocket,
    order: Awaited<ReturnType<OrdersService['getOrderById']>>,
  ): Promise<'customer' | 'rider' | null> {
    const { userId, roles } = client.data.user
    if (order.customerId.toString() === userId) return 'customer'

    if (roles.includes(UserRole.RIDER) && order.riderId) {
      // Use cached riderProfileId if available
      if (client.data.user.riderProfileId) {
        return client.data.user.riderProfileId === order.riderId.toString() ? 'rider' : null
      }
      try {
        const profile = await this.ridersService.getProfile(userId)
        client.data.user.riderProfileId = (profile._id as Types.ObjectId).toString()
        return client.data.user.riderProfileId === order.riderId.toString() ? 'rider' : null
      } catch {
        return null
      }
    }
    return null
  }

  // ── Connection lifecycle ─────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined
      if (!token) { client.disconnect(); return }

      const payload = this.jwtService.verify<JwtPayload>(token)
      const authClient = client as AuthenticatedSocket
      authClient.data.user = { userId: payload.sub, roles: payload.roles as string[] }

      client.join(`user_${payload.sub}`)
      this.logger.debug(`Chat client connected: ${payload.sub}`)
    } catch (err) {
      this.logger.warn(`Chat WS auth rejected: ${(err as Error).message}`)
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket): void {
    // Clean up any typing timers for this socket
    const authClient = client as AuthenticatedSocket
    const userId = authClient.data?.user?.userId
    if (userId) {
      for (const [key, timer] of this.typingTimers) {
        if (key.startsWith(`${userId}_`)) {
          clearTimeout(timer)
          this.typingTimers.delete(key)
        }
      }
    }
    this.logger.debug(`Chat client disconnected: ${client.id}`)
  }

  // ── chat:send ────────────────────────────────────────────────────
  // Returns ack to caller: { ok, error? }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ChatSendPayload,
  ): Promise<{ ok: boolean; error?: string }> {
    const { userId } = client.data.user

    if (!data.orderId || !Types.ObjectId.isValid(data.orderId)) {
      return { ok: false, error: 'Invalid order ID' }
    }
    if (!data.text || data.text.trim().length === 0) {
      return { ok: false, error: 'Message cannot be empty' }
    }

    if (this.isRateLimited(userId)) {
      return { ok: false, error: 'You are sending messages too fast. Please slow down.' }
    }

    const trimmedText = data.text.trim().slice(0, 500)

    let order: Awaited<ReturnType<OrdersService['getOrderById']>>
    try {
      order = await this.ordersService.getOrderById(data.orderId)
    } catch {
      return { ok: false, error: 'Order not found' }
    }

    const senderRole = await this.resolveSenderRole(client, order)
    if (!senderRole) {
      this.logger.warn(`chat:send denied: user ${userId} is not a participant of order ${data.orderId}`)
      return { ok: false, error: 'You are not a participant of this order' }
    }

    const message = await this.chatMessageModel.create({
      orderId:    new Types.ObjectId(data.orderId),
      senderId:   new Types.ObjectId(userId),
      senderRole,
      text:       trimmedText,
      isRead:     false,
      readAt:     null,
      deletedAt:  null,
    })

    const payload = {
      _id:        (message._id as Types.ObjectId).toString(),
      orderId:    data.orderId,
      senderId:   userId,
      senderRole,
      text:       trimmedText,
      isRead:     false,
      readAt:     null,
      createdAt:  (message as unknown as { createdAt: Date }).createdAt,
      tempId:     data.tempId ?? null,
    }

    this.server.to(`order_${data.orderId}`).emit('chat:message', payload)

    return { ok: true }
  }

  // ── chat:typing ──────────────────────────────────────────────────
  // Broadcast typing state to other participants in the order room.
  // Auto-clears after TYPING_TIMEOUT_MS if client goes silent.

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ChatTypingPayload,
  ): Promise<void> {
    const { userId } = client.data.user
    if (!data.orderId || !Types.ObjectId.isValid(data.orderId)) return

    // Resolve sender role so the receiver can show "Rider is typing…" vs "Customer is typing…"
    let order: Awaited<ReturnType<OrdersService['getOrderById']>>
    try { order = await this.ordersService.getOrderById(data.orderId) } catch { return }
    const senderRole = await this.resolveSenderRole(client, order)
    if (!senderRole) return

    const timerKey = `${userId}_${data.orderId}`

    // Clear any pending auto-stop timer
    const existing = this.typingTimers.get(timerKey)
    if (existing) clearTimeout(existing)

    // Broadcast typing state to everyone ELSE in the room
    client.to(`order_${data.orderId}`).emit('chat:peer_typing', {
      senderId:   userId,
      senderRole,
      isTyping:   data.isTyping,
      orderId:    data.orderId,
    })

    if (data.isTyping) {
      // Auto-stop: if client doesn't send another `isTyping: true` within timeout, stop
      this.typingTimers.set(timerKey, setTimeout(() => {
        client.to(`order_${data.orderId}`).emit('chat:peer_typing', {
          senderId: userId, senderRole, isTyping: false, orderId: data.orderId,
        })
        this.typingTimers.delete(timerKey)
      }, TYPING_TIMEOUT_MS))
    } else {
      this.typingTimers.delete(timerKey)
    }
  }

  // ── chat:read ────────────────────────────────────────────────────
  // Mark all messages from the other party as read and notify them.

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ChatReadPayload,
  ): Promise<void> {
    const { userId } = client.data.user
    if (!data.orderId || !Types.ObjectId.isValid(data.orderId)) return

    let order: Awaited<ReturnType<OrdersService['getOrderById']>>
    try { order = await this.ordersService.getOrderById(data.orderId) } catch { return }
    const senderRole = await this.resolveSenderRole(client, order)
    if (!senderRole) return

    // Mark all unread messages in this order sent by someone else as read
    await this.chatMessageModel.updateMany(
      {
        orderId:  new Types.ObjectId(data.orderId),
        senderId: { $ne: new Types.ObjectId(userId) },
        readAt:   null,
        deletedAt: null,
      },
      { $set: { isRead: true, readAt: new Date() } },
    )

    // Notify the other participant(s) that their messages were read
    client.to(`order_${data.orderId}`).emit('chat:messages_read', {
      orderId: data.orderId,
      readBy:  senderRole,
      readAt:  new Date().toISOString(),
    })
  }

  // ── chat:delete (admin only) ─────────────────────────────────────

  @SubscribeMessage('chat:delete')
  async handleDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { messageId: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const { roles } = client.data.user
    if (!roles.includes(UserRole.SUPER_ADMIN)) {
      return { ok: false, error: 'Not authorised' }
    }
    if (!Types.ObjectId.isValid(data.messageId)) {
      return { ok: false, error: 'Invalid message ID' }
    }

    const msg = await this.chatMessageModel.findByIdAndUpdate(
      data.messageId,
      { $set: { deletedAt: new Date() } },
      { new: true },
    )
    if (!msg) return { ok: false, error: 'Message not found' }

    // Notify room so clients hide/replace the message immediately
    this.server.to(`order_${msg.orderId.toString()}`).emit('chat:message_deleted', {
      messageId: data.messageId,
      orderId:   msg.orderId.toString(),
    })

    return { ok: true }
  }
}
