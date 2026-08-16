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
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'
import type { JwtPayload } from '@grandxl/types'

interface LocationUpdatePayload {
  lat: number
  lng: number
  bearing: number
  orderId?: string
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: { userId: string; roles: string[] }
  }
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: [
      process.env['CLIENT_URL'] ?? '',
      process.env['ADMIN_URL'] ?? '',
      process.env['RIDER_URL'] ?? 'http://localhost:5174',
    ].filter(Boolean),
    credentials: true,
  },
  namespace: '/',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly logger = new Logger(TrackingGateway.name)

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.['token'] as string | undefined
      if (!token) { client.disconnect(); return }

      const payload = this.jwtService.verify<JwtPayload>(token)
      const authClient = client as AuthenticatedSocket
      authClient.data.user = { userId: payload.sub, roles: payload.roles }

      client.join(`user_${payload.sub}`)
      this.logger.debug(`Client connected: ${payload.sub} (${payload.roles.join(',')})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('rider:location_update')
  handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LocationUpdatePayload,
  ): void {
    const { userId, roles } = client.data.user
    if (!roles.includes('rider')) return
    if (!data.orderId) return // no active order — nothing to broadcast

    this.server.to(`order_${data.orderId}`).emit('rider:location', {
      riderId: userId,
      lat: data.lat,
      lng: data.lng,
      bearing: data.bearing,
    })
  }

  @SubscribeMessage('order:join_room')
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { orderId: string },
  ): void {
    client.join(`order_${data.orderId}`)
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

  sendToOrderRoom(orderId: string, event: string, data: unknown): void {
    this.server.to(`order_${orderId}`).emit(event, data)
  }
}
