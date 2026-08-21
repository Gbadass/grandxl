import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useRiderStore } from '../../store/rider.store'
import { ridersApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import type { Order } from '@grandxl/types'

const OFFER_SECONDS = 45

function Sheet({ order, onDismiss }: { order: Order; onDismiss: () => void }) {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { setActiveOrder, removePendingJob } = useRiderStore()
  const [seconds, setSeconds] = useState(OFFER_SECONDS)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(() => {
    removePendingJob(order._id)
    onDismiss()
  }, [order._id, removePendingJob, onDismiss])

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
      setActiveOrder(order)
      removePendingJob(order._id)
      onDismiss()
      void navigate(`/delivery/${order._id}`, { replace: true })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('409') || message.includes('conflict')) {
        toast.error(t('job_taken_error'))
      } else {
        toast.error(t('job_accept_error'))
      }
      dismiss()
    },
  })

  const progress = (seconds / OFFER_SECONDS) * 100

  const pickup = order.restaurantPickupAddress
  const dropoff = order.deliveryAddress
  const payout = order.pricing.deliveryFee + (order.pricing.tip ?? 0)

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
              <p className="truncate text-sm font-medium text-white">
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

        {/* Buttons */}
        <div className="flex gap-3 px-5 pb-8">
          <button
            onClick={dismiss}
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
