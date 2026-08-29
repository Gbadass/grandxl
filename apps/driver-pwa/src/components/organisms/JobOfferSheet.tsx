import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { useRiderStore } from '../../store/rider.store'
import { ridersApi } from '@grandxl/api-client'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { startJobAlertLoop, stopJobAlertLoop } from '../../lib/alertSound'
import type { Order } from '@grandxl/types'

const OFFER_SECONDS = 45

type DeclineReason = 'too_far' | 'low_payout' | 'busy' | 'vehicle_issue' | 'other'

const DECLINE_REASONS: DeclineReason[] = [
  'too_far',
  'low_payout',
  'busy',
  'vehicle_issue',
  'other',
]

function Sheet({ order, onDismiss }: { order: Order; onDismiss: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { setActiveOrder, removePendingJob } = useRiderStore()
  const [seconds, setSeconds] = useState(OFFER_SECONDS)
  const [showDeclineReasons, setShowDeclineReasons] = useState(false)
  const [selectedReason, setSelectedReason] = useState<DeclineReason | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    stopJobAlertLoop()
    removePendingJob(order._id)
    onDismiss()
  }, [order._id, removePendingJob, onDismiss])

  // Start looping alert on mount — stops when rider accepts, declines, or timer expires
  useEffect(() => {
    startJobAlertLoop()
    return stopJobAlertLoop
  }, [])

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  useEffect(() => {
    if (seconds === 0) dismiss()
  }, [seconds, dismiss])

  const acceptMutation = useMutation({
    mutationFn: () => ridersApi.acceptJob(order._id),
    onSuccess: () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      stopJobAlertLoop()
      setActiveOrder(order)
      removePendingJob(order._id)
      onDismiss()
      void navigate(`/delivery/${order._id}`, { replace: true })
    },
    onError: async (err: unknown) => {
      const message = err instanceof Error ? err.message : ''
      const is409 = message.includes('409') || message.includes('conflict') || message.includes('already been accepted')

      if (!is409) {
        toast.error(parseApiError(err, t('job_accept_error')))
        dismiss()
        return
      }

      // 409 has two flavours: (a) another rider grabbed the broadcast first, or
      // (b) this rider was already assigned (admin push, or accept-happened-server-side
      // but ack got lost). We can't tell from the error alone — ask the server who
      // owns this order right now.
      try {
        const activeRes = await ridersApi.getActiveJob()
        const active = activeRes.data.data
        if (active && active._id === order._id) {
          // We own it — proceed as if accept succeeded
          if (intervalRef.current) clearInterval(intervalRef.current)
          stopJobAlertLoop()
          setActiveOrder(active)
          removePendingJob(order._id)
          onDismiss()
          void navigate(`/delivery/${order._id}`, { replace: true })
          return
        }
        // Someone else has this order (or we have a different active one). Show
        // an informative toast so rider doesn't think their tap did nothing.
        toast(t('job_taken_by_other', 'Another rider took this job.'), { icon: '🏁' })
        dismiss()
      } catch (fallbackErr) {
        // Couldn't reach the server to disambiguate — assume lost, tell the rider.
        toast.error(parseApiError(fallbackErr, t('job_accept_error')))
        dismiss()
      }
    },
  })

  const declineMutation = useMutation({
    mutationFn: (reason: DeclineReason) =>
      ridersApi.declineJob(order._id, t(`decline_reason.${reason}`)),
    onSuccess: () => {
      dismiss()
    },
    onError: () => {
      dismiss()
    },
  })

  const progress = (seconds / OFFER_SECONDS) * 100

  const pickup = order.restaurantPickupAddress
  const dropoff = order.deliveryAddress
  const payout = order.pricing.deliveryFee + (order.pricing.tip ?? 0)

  function handleDeclineClick() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setShowDeclineReasons(true)
  }

  function handleGoBack() {
    setShowDeclineReasons(false)
    setSelectedReason(null)
    // Resume countdown from remaining seconds
    intervalRef.current = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
  }

  function handleConfirmDecline() {
    if (!selectedReason) return
    declineMutation.mutate(selectedReason)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col">
      {/* Scrim */}
      <div className="fixed inset-0 bg-black/50" onClick={dismiss} />

      {/* Sheet */}
      <div className="relative rounded-t-3xl bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-slide-in-up">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-600" />
        </div>

        {/* Countdown bar */}
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-zinc-700">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <p className="text-lg font-bold text-white">{t('new_job_offer')}</p>
            <p className="text-sm text-zinc-400">#{order.orderNumber} · {seconds}s left</p>
            {/* Sprint 12 (S12-11): far-delivery heads-up */}
            {order.isFarDelivery && (
              <span className="mt-1 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-inset ring-amber-500/30">
                ★ Far delivery
              </span>
            )}
          </div>
          <div className="rounded-xl bg-primary/15 px-3 py-1.5">
            <p className="text-base font-bold text-primary">{formatMoney(payout, order.currency)}</p>
            <p className="text-center text-[10px] text-primary/70">Earn</p>
          </div>
        </div>

        {/* Route */}
        <div className="mx-5 mb-4 overflow-hidden rounded-2xl bg-zinc-800">
          <div className="flex items-start gap-3 px-4 py-3 border-b border-zinc-700">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('pickup_label')}</p>
              {order.restaurantName && (
                <p className="truncate text-sm font-bold text-white">{order.restaurantName}</p>
              )}
              <p className="truncate text-xs text-zinc-400">
                {pickup ? `${pickup.street}, ${pickup.city}` : 'Restaurant address'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('dropoff_label')}</p>
              <p className="truncate text-sm font-medium text-white">
                {dropoff.street}, {dropoff.city}
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mx-5 mb-5">
          <p className="text-xs text-zinc-500 mb-1.5">{t('item_count', { count: order.items.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {order.items.slice(0, 4).map((item, i) => (
              <span key={i} className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                {item.quantity}× {item.name}
              </span>
            ))}
            {order.items.length > 4 && (
              <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400">
                {t('more_items', { count: order.items.length - 4 })}
              </span>
            )}
          </div>
        </div>

        {/* Buttons area — animated between normal and decline-reason picker */}
        <div className="px-5 pb-8 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {!showDeclineReasons ? (
              <motion.div
                key="action-buttons"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3"
              >
                <button
                  onClick={handleDeclineClick}
                  disabled={acceptMutation.isPending}
                  className="flex-1 rounded-2xl border border-zinc-600 py-4 text-base font-bold text-zinc-300 transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50"
                >
                  {t('decline')}
                </button>
                <button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  className="flex-[2] rounded-2xl bg-primary py-4 text-base font-bold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
                >
                  {acceptMutation.isPending ? t('accepting') : t('accept_job')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="decline-reasons"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <p className="text-sm font-semibold text-zinc-300">{t('decline_reason_title')}</p>

                {/* Reason chips */}
                <div className="flex flex-wrap gap-2">
                  {DECLINE_REASONS.map((reason) => {
                    const isSelected = selectedReason === reason
                    return (
                      <button
                        key={reason}
                        onClick={() => setSelectedReason(reason)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-200'
                        }`}
                      >
                        {t(`decline_reason.${reason}`)}
                      </button>
                    )
                  })}
                </div>

                {/* Confirm / Go back */}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={handleConfirmDecline}
                    disabled={!selectedReason || declineMutation.isPending}
                    className="w-full rounded-2xl border border-zinc-600 py-4 text-base font-bold text-zinc-300 transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {declineMutation.isPending ? '…' : t('decline_confirm')}
                  </button>
                  <button
                    onClick={handleGoBack}
                    disabled={declineMutation.isPending}
                    className="text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                  >
                    {t('decline_go_back')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export function JobOfferSheet() {
  const { pendingJobs, removePendingJob } = useRiderStore()

  if (pendingJobs.length === 0) return null

  const currentJob = pendingJobs[0]!

  return (
    <Sheet
      key={currentJob._id}
      order={currentJob}
      onDismiss={() => removePendingJob(currentJob._id)}
    />
  )
}
