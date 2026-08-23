import { useEffect, useRef } from 'react'
import { socket } from '../lib/socket'
import { ridersApi } from '@grandxl/api-client'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'

const INTERVAL_MS = 30_000

export function useLocationTracking() {
  const isOnline = useRiderStore((s) => s.isOnline)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const watchRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !isOnline) {
      if (watchRef.current) clearInterval(watchRef.current)
      watchRef.current = null
      return
    }

    function sendLocation() {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const { latitude: lat, longitude: lng, heading } = coords
          const bearing = heading ?? 0
          socket.emit('rider:location_update', { lat, lng, bearing })
          void ridersApi.updateLocation({ lat, lng, bearing }).catch(() => undefined)
        },
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 },
      )
    }

    sendLocation()
    watchRef.current = setInterval(sendLocation, INTERVAL_MS)

    return () => {
      if (watchRef.current) clearInterval(watchRef.current)
      watchRef.current = null
    }
  }, [isAuthenticated, isOnline])
}
