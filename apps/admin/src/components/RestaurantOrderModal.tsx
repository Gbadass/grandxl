'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Bell, MapPin, StickyNote, Check, X, Volume2 } from 'lucide-react'
import { stopLoopAlarm, primeAudio, isAudioUnlocked, startLoopAlarm } from '../lib/alertSound'
import { formatMoney } from '@grandxl/utils'
import { ordersApi } from '@grandxl/api-client'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'

interface Props {
  order: Order
  onClose: () => void
}

const TIMEOUT_SECONDS = 180
const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function RestaurantOrderModal({ order, onClose }: Props) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(TIMEOUT_SECONDS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(isAudioUnlocked())

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          stopLoopAlarm()
          // Auto-cancel when restaurant doesn't respond in time — same as Glovo/UberEats
          void ordersApi
            .updateStatus(order._id, {
              status: OrderStatus.CANCELLED,
              cancelReason: 'Restaurant did not respond in time',
            })
            .catch(() => undefined)
          onClose()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [onClose, order._id])

  function dismiss() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    stopLoopAlarm()
    onClose()
  }

  // Dynamically pick the next valid status based on current order state.
  // Rider accept can auto-advance the order to PREPARING before the restaurant
  // taps Accept (race condition). In that case null signals "already handled".
  function getNextStatus(): OrderStatus | null {
    if (order.status === OrderStatus.PENDING) return OrderStatus.CONFIRMED
    if (order.status === OrderStatus.CONFIRMED) return OrderStatus.PREPARING
    // PREPARING or beyond — rider already accepted, nothing left to do
    return null
  }

  const confirmMutation = useMutation({
    mutationFn: () => {
      const next = getNextStatus()
      if (!next) {
        // Order was already accepted (rider took it), just close gracefully
        dismiss()
        router.push(`/restaurant/orders/${order._id}`)
        return Promise.resolve(undefined as unknown as import('axios').AxiosResponse)
      }
      return ordersApi.updateStatus(order._id, { status: next })
    },
    onSuccess: () => {
      if (getNextStatus() !== null) toast.success('Order accepted!')
      dismiss()
      router.push(`/restaurant/orders/${order._id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Could not accept — try again.')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      ordersApi.updateStatus(order._id, {
        status: OrderStatus.CANCELLED,
        cancelReason: 'Rejected by restaurant',
      }),
    onSuccess: () => {
      toast.success('Order rejected.')
      dismiss()
    },
    onError: () => toast.error('Could not reject — try again.'),
  })

  const isPending = confirmMutation.isPending || rejectMutation.isPending
  const progress = seconds / TIMEOUT_SECONDS
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress)
  const isUrgent = seconds <= 20

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="w-full max-w-sm overflow-hidden rounded-[28px] bg-gray-950 shadow-[0_32px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.06]"
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="relative flex flex-col items-center px-6 pt-8 pb-6 bg-gradient-to-b from-orange-500/[0.12] to-transparent">
            {/* Circular countdown ring */}
            <div className="relative mb-4">
              <svg width="100" height="100" className="-rotate-90">
                {/* Track */}
                <circle
                  cx="50" cy="50" r={RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="4"
                />
                {/* Progress arc */}
                <circle
                  cx="50" cy="50" r={RADIUS}
                  fill="none"
                  stroke={isUrgent ? '#EF4444' : '#F97316'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              {/* Bell icon center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div
                  animate={isUrgent ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                >
                  <Bell
                    size={22}
                    className={isUrgent ? 'text-red-400 fill-red-400/20' : 'text-orange-400 fill-orange-400/20'}
                  />
                </motion.div>
                <span className={`text-xs font-bold tabular-nums mt-0.5 ${isUrgent ? 'text-red-400' : 'text-orange-400'}`}>
                  {seconds}s
                </span>
              </div>
            </div>

            <p className="text-xl font-bold text-white tracking-tight">New Order!</p>
            <p className="mt-1 text-sm font-mono text-white/40">#{order.orderNumber}</p>

            {/* Shown when AudioContext is still suspended — clicking this gesture unlocks it */}
            {!audioEnabled && (
              <button
                onClick={() => {
                  primeAudio()
                  startLoopAlarm()
                  setAudioEnabled(true)
                }}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
              >
                <Volume2 size={14} />
                Tap to enable sound alerts
              </button>
            )}
          </div>

          {/* ── Order details ───────────────────────────────────────── */}
          <div className="px-5 pb-2">
            {/* Total + item count row */}
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-4 py-3 mb-3 ring-1 ring-white/[0.07]">
              <span className="text-sm text-white/50">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </span>
              <span className="text-lg font-bold text-orange-400 tabular-nums">
                {formatMoney(order.pricing.total, order.currency)}
              </span>
            </div>

            {/* Item list */}
            <ul className="space-y-2 mb-3">
              {order.items.slice(0, 4).map((item, i) => (
                <li key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-400">
                      {item.quantity}
                    </span>
                    <span className="text-sm text-white/80 truncate">{item.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 text-sm text-white/40 tabular-nums">
                    {formatMoney(item.itemTotal, order.currency)}
                  </span>
                </li>
              ))}
              {order.items.length > 4 && (
                <li className="text-xs text-white/30 pl-7">
                  +{order.items.length - 4} more items
                </li>
              )}
            </ul>

            {/* Delivery address */}
            {order.deliveryAddress && (
              <div className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 mb-2 ring-1 ring-white/[0.05]">
                <MapPin size={13} className="mt-0.5 shrink-0 text-white/30" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-0.5">
                    Deliver to
                  </p>
                  <p className="text-sm text-white/60 leading-snug">
                    {order.deliveryAddress.street}, {order.deliveryAddress.city}
                  </p>
                </div>
              </div>
            )}

            {/* Customer note */}
            {order.customerNote && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.08] px-3 py-2.5 mb-2 ring-1 ring-amber-500/20">
                <StickyNote size={13} className="mt-0.5 shrink-0 text-amber-400/70" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/60 mb-0.5">
                    Note
                  </p>
                  <p className="text-sm text-amber-200/80 leading-snug">{order.customerNote}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Actions ─────────────────────────────────────────────── */}
          <div className="flex gap-2.5 px-5 py-5">
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] py-3.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/[0.09] hover:text-white/80 active:bg-white/[0.04] disabled:opacity-40 cursor-pointer"
              style={{ minHeight: '52px' }}
            >
              <X size={15} />
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </button>
            <button
              onClick={() => confirmMutation.mutate()}
              disabled={isPending}
              className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(249,115,22,0.35)] transition-all hover:bg-orange-400 hover:shadow-[0_8px_30px_rgba(249,115,22,0.45)] active:bg-orange-600 disabled:opacity-50 cursor-pointer"
              style={{ minHeight: '52px' }}
            >
              <Check size={16} strokeWidth={2.5} />
              {confirmMutation.isPending ? 'Accepting…' : 'Accept Order'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
