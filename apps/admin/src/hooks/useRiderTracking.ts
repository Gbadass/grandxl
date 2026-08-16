'use client'

import { useEffect, useState } from 'react'
import { socket } from '../lib/socket'

interface RiderPosition {
  lat: number
  lng: number
  bearing: number
  updatedAt: number
}

interface TrackingResult {
  position: RiderPosition | null
  distanceKm: number | null
  etaMinutes: number | null
  status: 'waiting' | 'en_route' | 'nearby' | 'arrived'
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useRiderTracking(
  orderId: string | null,
  riderId: string | null,
  restaurantLat: number | null,
  restaurantLng: number | null,
): TrackingResult {
  const [position, setPosition] = useState<RiderPosition | null>(null)

  useEffect(() => {
    if (!orderId || !riderId) return

    function joinRoom() {
      socket.emit('order:join_room', { orderId: orderId! })
    }

    joinRoom()
    // Re-join on reconnect — socket loses room membership on disconnect
    socket.on('connect', joinRoom)

    function onLocation(data: { riderId: string; lat: number; lng: number; bearing: number }) {
      if (data.riderId !== riderId) return
      setPosition({ lat: data.lat, lng: data.lng, bearing: data.bearing, updatedAt: Date.now() })
    }

    socket.on('rider:location', onLocation)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('rider:location', onLocation)
      socket.emit('order:leave_room', { orderId })
    }
  }, [orderId, riderId])

  if (!position || restaurantLat === null || restaurantLng === null) {
    return { position: null, distanceKm: null, etaMinutes: null, status: 'waiting' }
  }

  const distanceKm = haversineKm(position.lat, position.lng, restaurantLat, restaurantLng)
  const etaMinutes = Math.ceil((distanceKm / 30) * 60) // 30 km/h average for motorcycle

  let status: TrackingResult['status'] = 'en_route'
  if (distanceKm < 0.1) status = 'arrived'
  else if (distanceKm < 0.5) status = 'nearby'

  return { position, distanceKm, etaMinutes, status }
}
