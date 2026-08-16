'use client'

import { useRiderTracking } from '../../hooks/useRiderTracking'

interface Props {
  orderId: string
  riderId: string
  restaurantLat: number | null
  restaurantLng: number | null
}

const STATUS_CONFIG = {
  waiting:  { label: 'On the way',    dot: 'bg-green-400',  text: 'text-green-700' },
  en_route: { label: 'En route',      dot: 'bg-blue-500',   text: 'text-blue-700'  },
  nearby:   { label: 'Almost here',   dot: 'bg-orange-500', text: 'text-orange-700'},
  arrived:  { label: 'At your door',  dot: 'bg-green-500',  text: 'text-green-700' },
}

export function RiderChip({ orderId, riderId, restaurantLat, restaurantLng }: Props) {
  const { distanceKm, etaMinutes, status } = useRiderTracking(
    orderId,
    riderId,
    restaurantLat,
    restaurantLng,
  )

  const cfg = STATUS_CONFIG[status]

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      {/* Icon */}
      <svg className="h-4 w-4 flex-shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="5.5" cy="17.5" r="2.5" />
        <circle cx="18.5" cy="17.5" r="2.5" />
        <path strokeLinecap="round" d="M5.5 17.5h-1a2 2 0 01-2-2V14l3-5h9l3 4h1a1 1 0 010 2h-1m-13 2.5V14m7-6.5l2 3.5" />
      </svg>

      {/* Pulse dot + status */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          {(status === 'en_route' || status === 'nearby') && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dot}`} />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
        </span>
        <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
      </div>

      {/* Distance + ETA */}
      {distanceKm !== null && (
        <span className="ml-auto text-xs text-gray-400">
          {distanceKm < 0.1
            ? 'Here'
            : distanceKm < 1
            ? `${Math.round(distanceKm * 1000)} m`
            : `${distanceKm.toFixed(1)} km`}
          {etaMinutes !== null && distanceKm >= 0.1 && (
            <> · ~{etaMinutes} min</>
          )}
        </span>
      )}

      {distanceKm === null && (
        <span className="ml-auto text-xs text-gray-400">Getting location…</span>
      )}
    </div>
  )
}
