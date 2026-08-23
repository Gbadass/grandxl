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
import { OrderDocument } from '../orders/schemas/order.schema'

interface LocationUpdatePayload {
  lat: number
  lng: number
  bearing: number
  orderId?: string
}

// Haversine distance in metres between two WGS-84 coordinates
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: { userId: string; roles: string[]; exp?: number }
  }
}

@Injectable()
@WebSocketGateway({
  cors: {
    // Use a callback so origins are evaluated at connection time (after dotenv loads),
    // not at class-definition time when process.env may still be empty.
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
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(TrackingGateway.name)
  // Tracks orders for which we've already sent the "rider approaching" alert so
  // we don't spam the restaurant on every subsequent location tick.
  private readonly proximityAlertSent = new Set<string>()
  private readonly customerProximityAlertSent = new Set<string>()

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocument>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined
      if (!token) { client.disconnect(); return }

      const payload = this.jwtService.verify<JwtPayload>(token)
      const authClient = client as AuthenticatedSocket
      authClient.data.user = { userId: payload.sub, roles: payload.roles, exp: payload.exp }

      client.join(`user_${payload.sub}`)
      if ((payload.roles as string[]).includes('super_admin')) {
        client.join('role_super_admin')
      }
      this.logger.debug(`Client connected: ${payload.sub} (${payload.roles.join(',')})`)
    } catch (err) {
      this.logger.warn(`WS auth rejected client=${client.id}: ${(err as Error).message}`)
      client.emit('auth:token_expired')
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`)
    // Clean up all order rooms this socket joined to prevent stale room memberships
    const rooms = Array.from(client.rooms).filter((r) => r.startsWith('order_'))
    rooms.forEach((room) => client.leave(room))
  }

  @SubscribeMessage('rider:location_update')
  handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LocationUpdatePayload,
  ): void {
    const { userId, roles, exp } = client.data.user
    if (exp && Date.now() / 1000 > exp) {
      client.emit('auth:token_expired')
      client.disconnect()
      return
    }
    if (!roles.includes('rider')) return
    if (!data.orderId) return // no active order — nothing to broadcast

    this.server.to(`order_${data.orderId}`).emit('rider:location', {
      riderId: userId,
      lat: data.lat,
      lng: data.lng,
      bearing: data.bearing,
    })

    // Proximity alert: when rider gets within 300m of the restaurant pickup point,
    // emit a WS event to the restaurant owner's room so the kitchen knows to have
    // the food at the counter. Fires once per order (de-duped via proximityAlertSent).
    const needsRestaurantCheck = !this.proximityAlertSent.has(data.orderId)
    const needsCustomerCheck   = !this.customerProximityAlertSent.has(data.orderId)
    if (needsRestaurantCheck || needsCustomerCheck) {
      void this.orderModel
        .findById(data.orderId, {
          restaurantPickupAddress: 1,
          restaurantOwnerId:       1,
          deliveryAddress:         1,
          status:                  1,
        })
        .lean()
        .then((order) => {
          if (!order) return
          const status = order['status'] as string

          // ── Restaurant approach (pickup leg: confirmed/preparing/ready) ──
          const pickupStatuses = new Set(['confirmed', 'preparing', 'ready'])
          if (needsRestaurantCheck && pickupStatuses.has(status)) {
            const coords = (order['restaurantPickupAddress'] as { coordinates: { coordinates: [number, number] } })
              ?.coordinates?.coordinates
            if (coords) {
              const [restLng, restLat] = coords
              const dist = haversineMetres(data.lat, data.lng, restLat, restLng)
              if (dist <= 300) {
                this.proximityAlertSent.add(data.orderId!)
                const ownerId = (order['restaurantOwnerId'] as Types.ObjectId).toString()
                this.server.to(`user_${ownerId}`).emit('rider:approaching_restaurant', {
                  orderId: data.orderId,
                  distanceMetres: Math.round(dist),
                })
                this.logger.debug(`Restaurant proximity alert for order=${data.orderId} dist=${Math.round(dist)}m`)
              }
            }
          }

          // ── Customer approach (delivery leg: picked_up) ──
          if (needsCustomerCheck && status === 'picked_up') {
            const delivCoords = (order['deliveryAddress'] as { coordinates: { coordinates: [number, number] } })
              ?.coordinates?.coordinates
            if (delivCoords) {
              const [delivLng, delivLat] = delivCoords
              const dist = haversineMetres(data.lat, data.lng, delivLat, delivLng)
              if (dist <= 500) {
                this.customerProximityAlertSent.add(data.orderId!)
                // Send to order room — customer is joined to order_{orderId}
                this.server.to(`order_${data.orderId}`).emit('rider:approaching_customer', {
                  orderId: data.orderId,
                  distanceMetres: Math.round(dist),
                })
                this.logger.debug(`Customer proximity alert for order=${data.orderId} dist=${Math.round(dist)}m`)
              }
            }
          }
        })
        .catch(() => undefined)
    }
  }

  @SubscribeMessage('order:join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { orderId: string },
  ): Promise<void> {
    const { userId, roles, exp } = client.data.user
    if (exp && Date.now() / 1000 > exp) {
      client.emit('auth:token_expired')
      client.disconnect()
      return
    }
    const { orderId } = data

    if (!Types.ObjectId.isValid(orderId)) return

    // Super-admins may join any order room
    if (roles.includes(UserRole.SUPER_ADMIN)) {
      client.join(`order_${orderId}`)
      return
    }

    // Verify the requesting user is a participant of this order
    const order = await this.orderModel
      .findById(orderId, { customerId: 1, riderId: 1, restaurantId: 1 })
      .lean()
      .catch(() => null)

    if (!order) return

    const uid = new Types.ObjectId(userId)
    const isCustomer = order.customerId.equals(uid)
    const isRider    = order.riderId ? order.riderId.equals(uid) : false
    // Restaurant owners join via their user ID — we trust they know their order ID
    const isRestaurantOwner = roles.includes(UserRole.RESTAURANT_OWNER)

    if (!isCustomer && !isRider && !isRestaurantOwner) {
      this.logger.warn(`WS room join denied: user ${userId} is not a participant of order ${orderId}`)
      return
    }

    client.join(`order_${orderId}`)
  }

  @SubscribeMessage('auth:refresh_token')
  handleRefreshToken(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { token: string },
  ): void {
    try {
      const payload = this.jwtService.verify<JwtPayload>(data.token)
      const previousUserId = client.data.user.userId
      client.data.user = { userId: payload.sub, roles: payload.roles, exp: payload.exp }
      // If the userId changed (e.g. impersonation edge-case), re-join the correct user room
      if (previousUserId !== payload.sub) {
        client.leave(`user_${previousUserId}`)
        client.join(`user_${payload.sub}`)
      }
      client.emit('auth:token_accepted')
    } catch (err) {
      this.logger.warn(`WS token refresh rejected client=${client.id}: ${(err as Error).message}`)
      client.emit('auth:token_expired')
      client.disconnect()
    }
  }

  @SubscribeMessage('order:leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { orderId: string },
  ): void {
    client.leave(`order_${data.orderId}`)
  }

  sendToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user_${userId}`).emit(event, data)
  }

  async getRoomSize(room: string): Promise<number> {
    const sockets = await this.server.in(room).fetchSockets()
    return sockets.length
  }

  sendToOrderRoom(orderId: string, event: string, data: unknown): void {
    this.server.to(`order_${orderId}`).emit(event, data)
  }

  // Called by TrackingService when order is PICKED_UP — allows the alert to re-fire
  // if the rider later accepts another order near the same restaurant.
  clearProximityAlert(orderId: string): void {
    this.proximityAlertSent.delete(orderId)
    this.customerProximityAlertSent.delete(orderId)
  }
}
