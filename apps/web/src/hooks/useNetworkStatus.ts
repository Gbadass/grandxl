import { useState, useEffect } from 'react'

interface NetworkStatus {
  isOnline: boolean
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true)
      setWasOffline(true)
      // Clear the wasOffline flag after 5 seconds
      setTimeout(() => setWasOffline(false), 5000)
    }

    function handleOffline(): void {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, wasOffline }
}
