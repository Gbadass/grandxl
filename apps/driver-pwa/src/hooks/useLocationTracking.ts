import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { socket } from '../lib/socket'
import { ridersApi } from '@grandxl/api-client'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'

// iOS PWA suspends setInterval when the app is backgrounded. watchPosition survives
// longer because it's a native callback the OS wakes for GPS updates. When the app
// resumes (visibilitychange → visible), we also force a fresh ping so dispatch sees
// us as soon as the rider looks at their screen again.
//
// Also throttles server writes — watchPosition can fire many times per second in a
// vehicle. We only forward at most once per THROTTLE_MS.
const THROTTLE_MS = 15_000

export function useLocationTracking(): void {
  const isOnline = useRiderStore((s) => s.isOnline)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setGpsStatus = useRiderStore((s) => s.setGpsStatus)
  const markGpsSuccess = useRiderStore((s) => s.markGpsSuccess)
  const watchIdRef = useRef<number | null>(null)
  const lastSentAtRef = useRef<number>(0)
  const lastToastedStatusRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !isOnline) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      lastToastedStatusRef.current = null
      return
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable')
      toast.error('GPS not supported on this device. Dispatch cannot see you.', {
        id: 'gps-unavailable', duration: 8000,
      })
      return
    }

    function forwardPosition(lat: number, lng: number, bearing: number): void {
      const now = Date.now()
      if (now - lastSentAtRef.current < THROTTLE_MS) return
      lastSentAtRef.current = now
      socket.emit('rider:location_update', { lat, lng, bearing })
      void ridersApi.updateLocation({ lat, lng, bearing }).catch(() => undefined)
      markGpsSuccess()
      lastToastedStatusRef.current = null
    }

    function onError(err: GeolocationPositionError): void {
      const status =
        err.code === err.PERMISSION_DENIED ? 'permission_denied' :
        err.code === err.POSITION_UNAVAILABLE ? 'unavailable' :
        err.code === err.TIMEOUT ? 'timeout' : 'unknown'
      setGpsStatus(status)
      if (lastToastedStatusRef.current !== status) {
        lastToastedStatusRef.current = status
        const message =
          status === 'permission_denied'
            ? 'GPS blocked. Tap the lock icon in your address bar → allow Location, then reload.'
            : status === 'unavailable'
              ? 'Cannot get GPS. Move to open sky and try again.'
              : status === 'timeout'
                ? 'GPS is slow. Check your signal.'
                : 'GPS problem. Dispatch cannot see you.'
        toast.error(message, { id: `gps-${status}`, duration: 8000 })
      }
    }

    // Fire one immediate ping (helps when the watch takes a while to warm up)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => forwardPosition(coords.latitude, coords.longitude, coords.heading ?? 0),
      onError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 },
    )

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => forwardPosition(coords.latitude, coords.longitude, coords.heading ?? 0),
      onError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    )

    // When the app comes back from background (iOS PWA usually pauses timers/watches
    // when backgrounded), force a fresh ping so dispatch sees the rider immediately.
    function onVisible(): void {
      if (document.visibilityState !== 'visible') return
      lastSentAtRef.current = 0 // bypass throttle for the resume ping
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => forwardPosition(coords.latitude, coords.longitude, coords.heading ?? 0),
        onError,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      )
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isAuthenticated, isOnline, setGpsStatus, markGpsSuccess])
}
