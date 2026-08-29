import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MapPin, Clock, Bike, Zap, TrendingUp, ChevronRight, Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ridersApi } from '@grandxl/api-client'
import type { Order } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { primeAudio, isAudioUnlocked } from '../lib/alertSound'

const POLL_MS = 20_000
const JOB_EXPIRE_SECONDS = 45

// ── Online toggle ─────────────────────────────────────────────────────────────

function OnlineMegaToggle() {
  const { isOnline, setOnline, rider } = useRiderStore()
  const qc = useQueryClient()
  const { t } = useTranslation('rider')
  const [toggling, setToggling] = useState(false)

  async function toggle() {
    if (toggling) return
    // Unlock AudioContext NOW — this is a guaranteed user gesture, before any job arrives
    primeAudio()
    setToggling(true)
    try {
      await ridersApi.toggleOnline(!isOnline)
      setOnline(!isOnline)
      void qc.invalidateQueries({ queryKey: ['available-jobs'] })
      toast.success(isOnline ? t('offline_toast') : t('online_toast'))
    } catch (err) {
      toast.error(parseApiError(err, t('status_error')))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-5">
      {/* Background glow when online */}
      <AnimatePresence>
        {isOnline && (
          <motion.div
            key="glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-green-500/8 via-transparent to-transparent pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-4">
        {/* Status icon */}
        <div className="relative">
          <motion.div
            className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
              isOnline ? 'bg-green-500/20' : 'bg-zinc-800'
            }`}
            animate={isOnline ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Bike size={26} className={isOnline ? 'text-green-400' : 'text-zinc-600'} />
          </motion.div>
          {isOnline && (
            <motion.div
              className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-green-400"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-display text-lg font-bold leading-tight transition-colors ${isOnline ? 'text-green-400' : 'text-zinc-400'}`}>
            {isOnline ? t('you_are_online') : t('you_are_offline')}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isOnline ? t('receiving_requests') : t('tap_to_start')}
          </p>
          {rider && (
            <p className="text-xs text-zinc-600 mt-1">
              ⭐ {rider.rating.toFixed(1)} rating · {rider.totalDeliveries} deliveries
            </p>
          )}
        </div>

        {/* Toggle switch */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => void toggle()}
          disabled={toggling}
          className={`relative h-8 w-14 rounded-full transition-colors duration-300 cursor-pointer disabled:opacity-60 shrink-0 ${
            isOnline ? 'bg-green-500' : 'bg-zinc-700'
          }`}
          style={{ touchAction: 'manipulation' }}
          aria-label={isOnline ? t('go_offline') : t('go_online')}
        >
          {toggling ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            </span>
          ) : (
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-md"
              style={{ left: isOnline ? '30px' : '4px' }}
            />
          )}
        </motion.button>
      </div>
    </div>
  )
}

// ── Job card with expiry countdown ───────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const JobCard = React.forwardRef<HTMLDivElement, { order: Order; onAccepted: (o: Order) => void }>(
  function JobCard({ order, onAccepted }, ref) {
  const { removePendingJob } = useRiderStore()
  const { t } = useTranslation('rider')
  const fee = order.pricing.deliveryFee + (order.pricing.tip ?? 0)

  const distanceKm = (() => {
    const pickup = order.restaurantPickupAddress?.coordinates?.coordinates
    const drop = order.deliveryAddress?.coordinates?.coordinates
    if (!pickup || !drop) return null
    return haversineKm(pickup[1], pickup[0], drop[1], drop[0])
  })()
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const [timeLeft, setTimeLeft] = useState(JOB_EXPIRE_SECONDS)

  function sendDecline() {
    removePendingJob(order._id)
    // Record the decline on the backend — swallow errors so UI stays responsive
    ridersApi.declineJob(order._id).catch(() => undefined)
  }

  // Countdown timer — auto-decline when timer hits zero
  useEffect(() => {
    if (timeLeft <= 0) {
      sendDecline()
      return
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  const urgency = timeLeft <= 10

  const { mutate: acceptJob } = useMutation({
    mutationFn: () => ridersApi.acceptJob(order._id),
    onMutate: () => setActing('accept'),
    onSuccess: () => {
      removePendingJob(order._id)
      onAccepted(order)
      toast.success(t('job_accepted'))
    },
    onError: (err: unknown) => {
      toast.error(parseApiError(err, t('job_taken')))
      removePendingJob(order._id)
    },
    onSettled: () => setActing(null),
  })

  function decline() {
    setActing('decline')
    setTimeout(() => sendDecline(), 150)
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`rounded-3xl border bg-zinc-900 overflow-hidden ${urgency ? 'border-red-500/40' : 'border-zinc-800'}`}
    >
      {/* Earnings + timer header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${urgency ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{t('your_earnings')}</p>
            <p className="font-display text-xl font-bold text-primary leading-tight">
              {formatMoney(fee, order.currency)}
            </p>
          </div>
        </div>
        {/* Countdown ring */}
        <div className={`flex flex-col items-center ${urgency ? 'text-red-400' : 'text-zinc-500'}`}>
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-zinc-800" />
              <motion.circle
                cx="18" cy="18" r="15.5"
                fill="none" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 15.5}`}
                strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - timeLeft / JOB_EXPIRE_SECONDS)}`}
                strokeLinecap="round"
                className={urgency ? 'stroke-red-500' : 'stroke-primary'}
                animate={{ strokeDashoffset: `${2 * Math.PI * 15.5 * (1 - timeLeft / JOB_EXPIRE_SECONDS)}` }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${urgency ? 'text-red-400' : 'text-zinc-300'}`}>
              {timeLeft}s
            </span>
          </div>
          <p className="text-[9px] mt-0.5 font-medium">{t('expires')}</p>
        </div>
      </div>

      {/* Route */}
      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-6 w-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <MapPin size={12} className="text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">{t('pick_up')}</p>
            <p className="text-sm text-zinc-300 leading-snug">
              {order.restaurantPickupAddress
                ? `${order.restaurantPickupAddress.street}, ${order.restaurantPickupAddress.city}`
                : t('restaurant_pickup')}
            </p>
          </div>
        </div>

        {/* Connector + distance badge */}
        <div className="ml-3 flex items-center gap-2">
          <div className="w-px h-4 bg-zinc-700 ml-[9px]" />
          {distanceKm !== null && (
            <span className="ml-4 px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400 border border-zinc-700/60">
              {distanceKm.toFixed(1)} km
            </span>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <MapPin size={12} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-0.5">{t('deliver_to')}</p>
            <p className="text-sm text-zinc-300 leading-snug truncate">
              {order.deliveryAddress.street}, {order.deliveryAddress.city}
            </p>
          </div>
        </div>

        {/* Order meta */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pt-0.5 border-t border-zinc-800/60">
          <span className="text-xs text-zinc-600 font-mono">{order.orderNumber}</span>
          <span className="text-zinc-800">·</span>
          <span className="text-xs text-zinc-600">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </span>
          <span className="text-zinc-800">·</span>
          <span className="text-xs text-zinc-600">{formatMoney(order.pricing.subtotal, order.currency)} order</span>
          {distanceKm !== null && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="text-xs font-semibold text-primary">{distanceKm.toFixed(1)} km trip</span>
            </>
          )}
          {/* Sprint 12 (S12-11): far-delivery signal — customer opted-in to a
              trip beyond the restaurant's normal range. Not a decision override,
              just a heads-up so the rider isn't surprised. */}
          {order.isFarDelivery && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="text-[10px] font-bold uppercase tracking-widest rounded-full bg-amber-500/20 text-amber-300 ring-1 ring-inset ring-amber-500/30 px-2 py-0.5">
                ★ Far delivery
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 pb-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={decline}
          disabled={acting !== null}
          className="flex-1 rounded-2xl border border-zinc-700 py-3.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-40 cursor-pointer"
          style={{ minHeight: '52px', touchAction: 'manipulation' }}
        >
          {acting === 'decline' ? '…' : t('decline')}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => acceptJob()}
          disabled={acting !== null}
          className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
          style={{ minHeight: '52px', touchAction: 'manipulation' }}
        >
          {acting === 'accept' && (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          )}
          {acting === 'accept' ? t('accepting') : t('accept_job')}
        </motion.button>
      </div>
    </motion.div>
  )
})

// ── Today's earnings strip ────────────────────────────────────────────────────

function TodayStrip() {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { rider } = useRiderStore()
  const pendingKobo  = rider?.earnings.pendingKobo ?? 0
  const settledKobo  = rider?.earnings.totalKobo ?? 0
  const currency = 'NGN'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <TrendingUp size={17} className="text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">{t('pending_earnings')}</p>
          <p className="font-display text-lg font-bold text-zinc-100">{formatMoney(pendingKobo, currency)}</p>
          {settledKobo > 0 && (
            <p className="text-[10px] text-zinc-600 mt-0.5">{formatMoney(settledKobo, currency)} {t('settled')}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => void navigate('/earnings')}
        className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        style={{ touchAction: 'manipulation' }}
      >
        {t('details')} <ChevronRight size={13} />
      </button>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AvailableJobsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { pendingJobs, isOnline, addPendingJob, setActiveOrder, activeOrder } = useRiderStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [soundEnabled, setSoundEnabled] = useState(isAudioUnlocked())

  // If there's already an active delivery (restored after refresh), go straight to it
  useEffect(() => {
    if (activeOrder) {
      void navigate(`/delivery/${activeOrder._id}`, { replace: true })
    }
  }, [activeOrder, navigate])

  // Recovery poll: check for an in-progress job every 10 s even when there's no activeOrder in
  // the store. This handles cases where AuthInit's getActiveJob call failed or the rider
  // accepted a job but the app was killed before the in-memory store was saved.
  // Navigation is handled by the useEffect above that watches activeOrder.
  useQuery({
    queryKey: ['active-job-recovery'],
    queryFn: async () => {
      const res = await ridersApi.getActiveJob()
      const order = res.data.data
      if (order) setActiveOrder(order)
      return order
    },
    enabled: isAuthenticated && !activeOrder,
    refetchInterval: 10_000,
    staleTime: 0,
    retry: false,
  })

  const { isError: jobsFeedError } = useQuery({
    queryKey: ['available-jobs'],
    queryFn: async () => {
      const res = await ridersApi.getAvailableJobs()
      const jobs = res.data.data
      // Use getState() to avoid stale closure — queryFn captures state at creation time
      const currentPending = useRiderStore.getState().pendingJobs
      jobs.forEach((job) => {
        if (!currentPending.find((p) => p._id === job._id)) addPendingJob(job)
      })
      return jobs
    },
    enabled: isAuthenticated && isOnline,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
    retry: 2,
  })

  function handleJobAccepted(order: Order) {
    setActiveOrder(order)
    void navigate(`/delivery/${order._id}`)
  }

  return (
    <div className="min-h-full px-4 py-4 space-y-3">
      {/* Enable sound alerts banner — only when online and AudioContext not yet unlocked */}
      {isOnline && !soundEnabled && !isAudioUnlocked() && (
        <button
          onClick={() => {
            primeAudio()
            setSoundEnabled(true)
          }}
          className="bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 mb-3 w-full text-left"
          style={{ touchAction: 'manipulation' }}
        >
          <Volume2 size={18} className="text-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-amber-300">{t('enable_sound')}</span>
        </button>
      )}

      {/* Jobs feed error banner */}
      {jobsFeedError && isOnline && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 px-4 py-3">
          <div className="h-7 w-7 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <Volume2 size={14} className="text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-400">{t('jobs_feed_error')}</p>
        </div>
      )}

      {/* Today's earnings */}
      <TodayStrip />

      {/* Online mega toggle */}
      <OnlineMegaToggle />

      {/* Jobs list / empty states */}
      <AnimatePresence mode="popLayout">
        {!isOnline && (
          <motion.div
            key="offline-state"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-800/60 bg-zinc-900/40 py-14"
          >
            <div className="h-16 w-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <Bike size={30} className="text-zinc-600" />
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-zinc-400">{t('offline_title')}</p>
              <p className="text-xs text-zinc-600 mt-1">{t('offline_hint')}</p>
            </div>
          </motion.div>
        )}

        {isOnline && pendingJobs.length === 0 && (
          <motion.div
            key="waiting-state"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-800/60 bg-zinc-900/40 py-14"
          >
            <div className="relative h-16 w-16">
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/10"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <div className="h-16 w-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <Clock size={30} className="text-zinc-500" />
              </div>
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-zinc-400">{t('waiting_title')}</p>
              <p className="text-xs text-zinc-600 mt-1">{t('waiting_hint')}</p>
            </div>
          </motion.div>
        )}

        {isOnline && pendingJobs.map((order) => (
          <JobCard key={order._id} order={order} onAccepted={handleJobAccepted} />
        ))}
      </AnimatePresence>
    </div>
  )
}
