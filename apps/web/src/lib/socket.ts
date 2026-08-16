import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@grandxl/types'

// Strip /api/v1 — the Socket.IO gateway lives at the server root, not under the REST prefix
const socketUrl = (import.meta.env.VITE_API_URL as string ?? '').replace(/\/api\/v\d+\/?$/, '')

// Created but NOT connected — useSocket hook manages the lifecycle.
// Connects when user authenticates, disconnects on logout.
export const socket: Socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
})

export type TypedSocket = typeof socket & {
  on: <K extends keyof ServerToClientEvents>(event: K, listener: ServerToClientEvents[K]) => typeof socket
  emit: <K extends keyof ClientToServerEvents>(event: K, ...args: Parameters<ClientToServerEvents[K]>) => typeof socket
}
