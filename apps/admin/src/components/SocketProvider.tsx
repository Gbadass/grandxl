'use client'

import { useSocket } from '../hooks/useSocket'

// Renders nothing — just activates real-time socket listeners.
// Mount once inside any authenticated layout.
export function SocketProvider(): null {
  useSocket()
  return null
}
