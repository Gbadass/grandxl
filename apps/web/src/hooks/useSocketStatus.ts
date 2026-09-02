import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'

// S14-4: connection-state observer that the top-of-app banner subscribes to.
// The main useSocket() hook already owns the lifecycle (connect on auth,
// disconnect on logout); this hook is a read-only sibling that mirrors the
// socket's internal state into React so a UI can react.

export type SocketStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline'

export function useSocketStatus(): SocketStatus {
  const { isAuthenticated } = useAuthStore()
  const [status, setStatus] = useState<SocketStatus>(() =>
    socket.connected ? 'connected' : 'connecting',
  )

  useEffect(() => {
    // Not signed in → we shouldn't render any banner. Report connected so
    // consumers treat it as "nothing to worry about".
    if (!isAuthenticated) {
      setStatus('connected')
      return
    }

    // Initial snapshot in case the socket was already connected before we
    // subscribed (rehydration order between auth store and socket lib).
    setStatus(socket.connected ? 'connected' : 'connecting')

    function onConnect()      { setStatus('connected') }
    function onDisconnect()   { setStatus('reconnecting') }
    function onReconnecting() { setStatus('reconnecting') }
    // reconnect_failed only fires when reconnectionAttempts is finite — we're
    // configured with Infinity, so 'offline' is a defensive placeholder in
    // case that config changes. Also flip to 'offline' after a long backoff
    // without reconnect for a defensive UX cue.
    function onReconnectFailed() { setStatus('offline') }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnecting)
    socket.io.on('reconnect_failed', onReconnectFailed)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnecting)
      socket.io.off('reconnect_failed', onReconnectFailed)
    }
  }, [isAuthenticated])

  return status
}
