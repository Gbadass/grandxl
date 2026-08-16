import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@grandxl/types'

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

// Strip /api/v1 — the socket gateway lives at the server root, not under the REST prefix
const socketUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/api\/v\d+\/?$/, '')

// Created once, connected/disconnected by useSocket hook
export const socket: TypedSocket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket'],
}) as TypedSocket
