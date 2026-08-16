import { io } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@grandxl/types'

// Strip /api/v1 — the socket gateway lives at the server root, not under the REST prefix
const socketUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/api\/v\d+\/?$/, '')

// Created once, connected/disconnected by useSocket hook
export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true, // admin uses httpOnly cookie auth, also send bearer token via auth{}
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket'],
})

import type { Socket } from 'socket.io-client'
export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>
