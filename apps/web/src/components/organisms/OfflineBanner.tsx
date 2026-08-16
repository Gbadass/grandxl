import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetworkStatus()
  const queryClient = useQueryClient()

  // Refetch stale queries when connection is restored
  useEffect(() => {
    if (wasOffline && isOnline) {
      queryClient.invalidateQueries()
    }
  }, [wasOffline, isOnline, queryClient])

  if (isOnline && !wasOffline) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium text-white transition-all ${
        isOnline ? 'bg-success' : 'bg-warning'
      }`}
    >
      {isOnline
        ? 'Back online — refreshing data...'
        : 'No internet connection. Some features may be unavailable.'}
    </div>
  )
}
