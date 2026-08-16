'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { OrderStatus } from '@grandxl/types'
import { useRiderTracking } from '../../hooks/useRiderTracking'

const HOLDING_THRESHOLD_SEC = 90

interface Props {
  orderId: string
  status: OrderStatus
  riderId: string | null
  restaurantLat: number | null
  restaurantLng: number | null
  /** Minutes since the order was placed — used for the searching state. */
  searchingForMinutes: number
  /** When the order entered READY status — for "Holding for rider" escalation. */
  readyAt?: string | Date | null
}

/**
 * Right-hand status panel. One of:
 *  - "Finding a rider" (CONFIRMED, no riderId) with radar pulse animation
 *  - Rider info chip (CONFIRMED + rider, or PICKED_UP) with name placeholder, distance, ETA
 *  - "In the kitchen" (PREPARING) — subtle stove animation
 *  - "Ready for pickup" (READY) — rider distance + ping
 *  - "Delivered" (DELIVERED) — celebratory check
 */
export function DispatchStatus({
  orderId,
  status,
  riderId,
  restaurantLat,
  restaurantLng,
  searchingForMinutes,
  readyAt,
}: Props) {
  const { distanceKm, etaMinutes, status: trackingStatus } = useRiderTracking(
    orderId,
    riderId,
    restaurantLat,
    restaurantLng,
  )

  // Tick once per second while READY so the holding state reveals after threshold.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== OrderStatus.READY) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [status])

  const secondsHolding = status === OrderStatus.READY && readyAt
    ? Math.floor((now - new Date(readyAt).getTime()) / 1000)
    : 0
  const isHolding =
    status === OrderStatus.READY &&
    secondsHolding > HOLDING_THRESHOLD_SEC &&
    (distanceKm === null || distanceKm >= 0.1)

  // Escalated state — show first so it overrides the "Ready for pickup" tone
  if (isHolding) {
    return (
      <Frame tone="amber" icon={<ClockIcon />}>
        <Headline>Holding for rider</Headline>
        <Sub>
          Ready for {Math.floor(secondsHolding / 60)}m {secondsHolding % 60}s ·{' '}
          {distanceKm !== null
            ? `${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} away${etaMinutes !== null ? ` · ~${etaMinutes} min` : ''}`
            : 'Locating rider…'}
        </Sub>
      </Frame>
    )
  }

  // PREPARING — kitchen
  if (status === OrderStatus.PREPARING) {
    return (
      <Frame tone="amber" icon={<FlameIcon />}>
        <Headline>In the kitchen</Headline>
        <Sub>Mark the order ready when it&apos;s packed.</Sub>
      </Frame>
    )
  }

  // READY — waiting for rider pickup
  if (status === OrderStatus.READY) {
    return (
      <Frame tone="emerald" icon={<BellIcon />}>
        <Headline>Ready for pickup</Headline>
        <Sub>
          {distanceKm !== null
            ? distanceKm < 0.1
              ? 'Rider is at your door.'
              : `Rider is ${formatDistance(distanceKm)} away · ETA ~${etaMinutes ?? '–'} min`
            : 'Rider is on the way.'}
        </Sub>
      </Frame>
    )
  }

  if (status === OrderStatus.PICKED_UP) {
    return (
      <Frame tone="blue" icon={<MotorcycleIcon />}>
        <Headline>Picked up</Headline>
        <Sub>Order is on its way to the customer.</Sub>
      </Frame>
    )
  }

  if (status === OrderStatus.DELIVERED) {
    return (
      <Frame tone="emerald" icon={<CheckCircleIcon />}>
        <Headline>Delivered</Headline>
        <Sub>Order completed successfully.</Sub>
      </Frame>
    )
  }

  // CONFIRMED branch
  if (!riderId) {
    return (
      <Frame tone="orange" icon={<RadarPulse />}>
        <AnimatePresence mode="wait">
          <motion.div
            key="searching"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <Headline>
              Finding a rider
              <motion.span
                aria-hidden
                className="ml-1 inline-block"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              >
                …
              </motion.span>
            </Headline>
            <Sub>
              Searching nearby couriers
              {searchingForMinutes > 0 && ` · ${searchingForMinutes} min`}
            </Sub>
          </motion.div>
        </AnimatePresence>
      </Frame>
    )
  }

  // Rider assigned and en route to restaurant
  return (
    <Frame tone="blue" icon={<MotorcycleIcon />}>
      <Headline>Rider on the way</Headline>
      <Sub>
        {distanceKm !== null
          ? distanceKm < 0.1
            ? 'At your door — hand over the order.'
            : `${formatDistance(distanceKm)} away · ETA ~${etaMinutes ?? '–'} min`
          : 'Getting their location…'}
        {trackingStatus === 'nearby' && (
          <motion.span
            className="ml-1.5 inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            ALMOST HERE
          </motion.span>
        )}
      </Sub>
    </Frame>
  )
}

// ── Shared primitives ────────────────────────────────────────────────────────

type Tone = 'orange' | 'amber' | 'emerald' | 'blue'

const TONE_BG: Record<Tone, string> = {
  orange:  'border-orange-200 bg-orange-50',
  amber:   'border-amber-200 bg-amber-50',
  emerald: 'border-emerald-200 bg-emerald-50',
  blue:    'border-blue-200 bg-blue-50',
}

const TONE_ICON: Record<Tone, string> = {
  orange:  'bg-orange-100 text-orange-700',
  amber:   'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue:    'bg-blue-100 text-blue-700',
}

function Frame({ tone, icon, children }: { tone: Tone; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-center gap-3 rounded-xl border p-3 ${TONE_BG[tone]}`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_ICON[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </motion.div>
  )
}

function Headline({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-sm font-bold text-gray-900">{children}</p>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-0.5 truncate text-xs text-gray-600">{children}</p>
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// ── Icons ────────────────────────────────────────────────────────────────────

function RadarPulse() {
  return (
    <div className="relative h-5 w-5">
      <motion.span
        className="absolute inset-0 rounded-full bg-orange-400/60"
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.span
        className="absolute inset-0 rounded-full bg-orange-400/60"
        animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
        transition={{ duration: 1.6, delay: 0.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <span className="absolute inset-1 rounded-full bg-orange-500" />
    </div>
  )
}

function MotorcycleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path strokeLinecap="round" d="M5.5 17.5h-1a2 2 0 01-2-2V14l3-5h9l3 4h1a1 1 0 010 2h-1m-13 2.5V14m7-6.5l2 3.5" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <motion.svg
      className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M12 2C10 5 7 7 7 11a5 5 0 0010 0c0-2-1-3-1-5 0-1.5-1-3-4-4z" />
    </motion.svg>
  )
}

function BellIcon() {
  return (
    <motion.svg
      className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      animate={{ rotate: [0, -12, 12, -6, 6, 0] }}
      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </motion.svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <motion.svg
      className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      animate={{ rotate: [0, 8, 0] }}
      transition={{ duration: 1.8, repeat: Infinity }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </motion.svg>
  )
}
