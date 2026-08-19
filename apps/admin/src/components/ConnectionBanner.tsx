'use client'

import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

export function ConnectionBanner() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected')
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    function onConnect() {
      setStatus('connected')
      setShowReconnected(true)
      // Hide the "back online" toast after 3 seconds
      const t = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(t)
    }
    function onDisconnect() {
      setStatus('disconnected')
      setShowReconnected(false)
    }
    function onReconnectAttempt() {
      setStatus('reconnecting')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_attempt', onReconnectAttempt)

    // Sync with current socket state on mount
    if (socket.connected) setStatus('connected')

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_attempt', onReconnectAttempt)
    }
  }, [])

  if (status === 'connected' && !showReconnected) return null

  if (showReconnected) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Back online — orders refreshed
      </div>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse shrink-0" />
      {status === 'reconnecting'
        ? 'Reconnecting to server — your orders are safe, do not refresh'
        : 'Disconnected from server — reconnecting…'}
    </div>
  )
}
