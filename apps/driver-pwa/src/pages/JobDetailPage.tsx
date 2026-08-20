import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ChevronLeft, MapPin, Package, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ridersApi } from '@grandxl/api-client'
import { useRiderStore } from '../store/rider.store'
import { formatMoney } from '@grandxl/utils'
import { ROUTES } from '../router/routes'

export default function JobDetailPage() {
  const { t } = useTranslation('rider')
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { pendingJobs, removePendingJob, setActiveOrder } = useRiderStore()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  const order = pendingJobs.find((o) => o._id === orderId)

  if (!order) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle size={32} className="text-zinc-600" />
        <p className="text-sm text-zinc-400">This job is no longer available</p>
        <button
          onClick={() => void navigate(ROUTES.AVAILABLE_JOBS)}
          className="text-sm text-primary underline cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          Back to jobs
        </button>
      </div>
    )
  }

  const fee = order.pricing.deliveryFee + (order.pricing.tip ?? 0)
  const pickupAddress = order.restaurantPickupAddress
    ? `${order.restaurantPickupAddress.street}, ${order.restaurantPickupAddress.city}`
    : 'Restaurant pickup location'
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)

  async function accept() {
    if (loading) return
    setLoading('accept')
    try {
      await ridersApi.acceptJob(order!._id)
      removePendingJob(order!._id)
      setActiveOrder(order!)
      void navigate(`/delivery/${order!._id}`, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Could not accept job. Try again.')
      setLoading(null)
    }
  }

  async function decline() {
    if (loading) return
    setLoading('decline')
    try {
      await ridersApi.declineJob(order!._id)
    } catch {
      // ignore — backend decline is best-effort; local removal always happens
    } finally {
      removePendingJob(order!._id)
      void navigate(-1)
    }
  }

  return (
    <div className="min-h-full px-4 py-4 pb-8">
      <button
        onClick={() => void navigate(-1)}
        className="mb-5 flex cursor-pointer items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <ChevronLeft size={18} />
        {t('common:back')}
      </button>

      {/* Header — earnings */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 font-mono">{order.orderNumber}</p>
          <p className="text-2xl font-display font-bold text-primary mt-0.5">
            {formatMoney(fee, order.currency)}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">you earn on this delivery</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
          <Package size={12} className="text-zinc-500" />
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </div>
      </div>

      {/* Route card */}
      <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Pickup */}
        <div className="flex items-start gap-3 px-4 py-4 border-b border-zinc-800/60">
          <div className="mt-0.5 flex flex-col items-center gap-1 shrink-0">
            <div className="h-7 w-7 rounded-full bg-secondary/15 flex items-center justify-center">
              <MapPin size={13} className="text-secondary" />
            </div>
            <div className="w-px flex-1 min-h-[16px] bg-zinc-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">
              Pick up from
            </p>
            <p className="text-sm text-zinc-200 leading-snug">{pickupAddress}</p>
          </div>
        </div>

        {/* Delivery */}
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="mt-0.5 shrink-0">
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
              <MapPin size={13} className="text-primary" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">
              Deliver to
            </p>
            <p className="text-sm text-zinc-200 leading-snug">
              {order.deliveryAddress.street}, {order.deliveryAddress.city}
            </p>
            {order.deliveryAddress.state && (
              <p className="text-xs text-zinc-500 mt-0.5">{order.deliveryAddress.state}</p>
            )}
          </div>
        </div>
      </div>

      {/* Earnings breakdown */}
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <div className="flex justify-between py-1.5 text-zinc-400">
          <span>{t('delivery_fee')}</span>
          <span className="text-zinc-200">{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
        </div>
        {(order.pricing.tip ?? 0) > 0 && (
          <div className="flex justify-between py-1.5 text-zinc-400">
            <span className="flex items-center gap-1.5">
              {t('tip')}
              <span className="text-[10px] text-secondary font-semibold bg-secondary/10 px-1.5 py-0.5 rounded-full">
                Customer tip
              </span>
            </span>
            <span className="text-secondary font-semibold">
              +{formatMoney(order.pricing.tip, order.currency)}
            </span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-zinc-800 pt-2.5 font-bold text-zinc-100">
          <span>You earn</span>
          <span className="text-primary text-base">{formatMoney(fee, order.currency)}</span>
        </div>
      </div>

      {/* Estimated time (if set) */}
      {order.estimatedTime && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <Clock size={14} className="text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-400">
            Estimated delivery time: <span className="text-zinc-200 font-medium">{order.estimatedTime} min</span>
          </p>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => void decline()}
          disabled={loading !== null}
          className="flex-1 cursor-pointer rounded-2xl border border-zinc-700 py-3.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500 transition-colors disabled:opacity-50"
          style={{ touchAction: 'manipulation', minHeight: '52px' }}
        >
          {loading === 'decline' ? (
            <span className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-zinc-200 animate-spin inline-block" />
          ) : (
            t('decline')
          )}
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => void accept()}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-2xl bg-primary py-3.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ touchAction: 'manipulation', minHeight: '52px' }}
        >
          {loading === 'accept' ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            t('accept')
          )}
        </motion.button>
      </div>
    </div>
  )
}
