import { useEffect } from 'react'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'

// Manages the socket lifecycle for the entire app.
// Mounted once at root level — connects when authenticated, disconnects on logout.
export function useSocket(): void {
  const { isAuthenticated, accessToken } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socket.connected) socket.disconnect()
      return
    }

    // Attach auth token so the gateway can verify identity on connect
    socket.auth = { token: accessToken }

    if (!socket.connected) socket.connect()

    return () => {
      // Don't disconnect on re-render — only disconnect when auth state clears
    }
  }, [isAuthenticated, accessToken])

  // Disconnect cleanly when the component unmounts (app root unmounts = page close)
  useEffect(() => {
    return () => {
      socket.disconnect()
    }
  }, [])
}
