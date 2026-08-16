import { io } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@grandxl/types'

// Strip /api/v1 — the socket gateway lives at the server root, not under the REST prefix
const socketUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/v\d+\/?$/, '')

// Socket instance — created but NOT connected yet.
// Connected in useSocket hook when user authenticates.
export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: false, // mobile uses token auth, not cookies
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  transports: ['websocket'],
})

// Type-safe socket using GrandXL event interfaces
export type TypedSocket = ReturnType<
  typeof io<ServerToClientEvents, ClientToServerEvents>
>
