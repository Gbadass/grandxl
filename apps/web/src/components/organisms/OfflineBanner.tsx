import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { socket } from '../../lib/socket'

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  // Refetch stale queries when network comes back
  useEffect(() => {
    if (wasOffline && isOnline) {
      queryClient.invalidateQueries()
    }
  }, [wasOffline, isOnline, queryClient])

  // Also refetch when socket reconnects (server crash recovery)
  useEffect(() => {
    function onReconnect() {
      queryClient.invalidateQueries()
    }
    socket.on('connect', onReconnect)
    return () => { socket.off('connect', onReconnect) }
  }, [queryClient])

  if (isOnline && !wasOffline) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium text-white transition-all ${
        isOnline ? 'bg-success' : 'bg-warning'
      }`}
    >
      {isOnline ? t('online') : t('offline')}
    </div>
  )
}
