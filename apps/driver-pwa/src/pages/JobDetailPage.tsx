import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, MapPin } from 'lucide-react'
import { useRiderStore } from '../store/rider.store'
import { formatMoney } from '@grandxl/utils'

export default function JobDetailPage() {
  const { t } = useTranslation('rider')
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { pendingJobs, removePendingJob } = useRiderStore()

  const order = pendingJobs.find((o) => o._id === orderId)

  if (!order) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-zinc-400">{t('common:error')}</p>
      </div>
    )
  }

  const fee = order.pricing.deliveryFee + order.pricing.tip

  function accept() {
    // TODO: call POST /riders/jobs/:orderId/accept
    removePendingJob(order!._id)
    void navigate('/', { replace: true })
  }

  function decline() {
    removePendingJob(order!._id)
    void navigate(-1)
  }

  return (
    <div className="min-h-full px-4 py-4">
      <button
        onClick={() => void navigate(-1)}
        className="mb-6 flex cursor-pointer items-center gap-1 text-sm text-zinc-400"
      >
        <ChevronLeft size={18} />
        {t('common:back')}
      </button>

      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {t('order_number', { number: order.orderNumber })}
          </span>
          <span className="text-lg font-bold text-primary">
            {formatMoney(fee, order.currency)}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 text-zinc-300">
            <MapPin size={14} className="mt-0.5 shrink-0 text-secondary" />
            <div>
              <p className="text-xs font-medium text-zinc-500">{t('pick_up_from')}</p>
              <p>Restaurant address here</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-zinc-300">
            <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-zinc-500">{t('deliver_to')}</p>
              <p>
                {order.deliveryAddress.street}, {order.deliveryAddress.city}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
        <div className="flex justify-between py-1.5 text-zinc-400">
          <span>{t('delivery_fee')}</span>
          <span className="text-zinc-200">{formatMoney(order.pricing.deliveryFee, order.currency)}</span>
        </div>
        {order.pricing.tip > 0 && (
          <div className="flex justify-between py-1.5 text-zinc-400">
            <span>{t('tip')}</span>
            <span className="text-secondary">{formatMoney(order.pricing.tip, order.currency)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-zinc-800 pt-2 font-semibold text-zinc-100">
          <span>You earn</span>
          <span>{formatMoney(fee, order.currency)}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={decline}
          className="flex-1 cursor-pointer rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300"
        >
          {t('decline')}
        </button>
        <button
          onClick={accept}
          className="flex-1 cursor-pointer rounded-xl bg-primary py-3 text-sm font-semibold text-white"
        >
          {t('accept')}
        </button>
      </div>
    </div>
  )
}
