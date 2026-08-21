import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, Bike, Clock, Target, ChevronRight, Package } from 'lucide-react'
import { ridersApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import type { Order } from '@grandxl/types'
import { useRiderStore } from '../store/rider.store'

const stagger = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.22 } }),
}

function formatRelativeDate(date: Date | string): string {
  const d = new Date(date)
  const diffMs = Date.now() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return `Today · ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

/** Builds a 7-bucket histogram (Mon–Sun of current week) from a list of completed orders */
function buildWeeklyBars(orders: Order[]) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const buckets = new Array<number>(7).fill(0)
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // shift so Mon=0

  orders.forEach((o) => {
    const d = new Date(o.updatedAt)
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 7) {
      const bucket = (dayOfWeek - diff + 7) % 7
      buckets[bucket] += o.pricing.deliveryFee + (o.pricing.tip ?? 0)
    }
  })

  const max = Math.max(...buckets, 1)
  return days.map((label, i) => ({
    label,
    amount: buckets[i],
    height: buckets[i] / max,
    isToday: i === dayOfWeek,
  }))
}

function WeeklyBarChart({ orders }: { orders: Order[] }) {
  const { t } = useTranslation('rider')
  const bars = buildWeeklyBars(orders)
  const totalWeekKobo = bars.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('this_week')}</p>
        <p className="text-sm font-bold text-zinc-100">{formatMoney(totalWeekKobo, 'NGN')}</p>
      </div>
      <p className="text-[10px] text-zinc-600 mb-4">{t('earnings_by_day')}</p>
      <div className="flex items-end gap-1.5 h-16">
        {bars.map((bar, i) => (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
              <motion.div
                className={`w-full rounded-t-md ${bar.isToday ? 'bg-primary' : 'bg-zinc-700'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(bar.height * 48, bar.amount > 0 ? 4 : 1)}px` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: 'easeOut' }}
              />
            </div>
            <p className={`text-[9px] font-medium ${bar.isToday ? 'text-primary' : 'text-zinc-600'}`}>
              {bar.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EarningsPage() {
  const { t } = useTranslation('rider')
  const navigate = useNavigate()
  const { rider, setRider } = useRiderStore()
  const [historyPage, setHistoryPage] = useState(1)
  const [allDeliveries, setAllDeliveries] = useState<Order[]>([])

  const { data: freshProfile } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: () => ridersApi.getProfile().then((r) => r.data.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (freshProfile) setRider(freshProfile)
  }, [freshProfile, setRider])

  const liveRider = freshProfile ?? rider
  const currency = 'NGN'
  const totalKobo = liveRider?.earnings.totalKobo ?? 0
  const pendingKobo = liveRider?.earnings.pendingKobo ?? 0

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['rider-metrics'],
    queryFn: () => ridersApi.getMetrics(30).then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const { data: historyData, isFetching: historyFetching } = useQuery({
    queryKey: ['rider-delivery-history', historyPage],
    queryFn: () => ridersApi.getDeliveryHistory({ page: historyPage, limit: 10 }).then((r) => r.data.data),
    staleTime: 1000 * 60 * 2,
  })

  useEffect(() => {
    if (!historyData) return
    const incoming: Order[] = historyData.data ?? []
    setAllDeliveries((prev) => {
      const ids = new Set(prev.map((o) => o._id))
      return [...prev, ...incoming.filter((o) => !ids.has(o._id))]
    })
  }, [historyData])

  return (
    <div className="min-h-full px-4 py-4 pb-8">
      <motion.h1
        custom={0} variants={stagger} initial="hidden" animate="visible"
        className="mb-5 font-display text-lg font-bold text-zinc-100"
      >
        {t('earnings')}
      </motion.h1>

      {/* ── Earnings summary ── */}
      <motion.div
        custom={1} variants={stagger} initial="hidden" animate="visible"
        className="mb-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1">{t('earnings_total')}</p>
            <p className="font-display text-2xl font-bold text-zinc-100 tabular-nums">{formatMoney(totalKobo, currency)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('all_time_settled')}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide mb-1">{t('earnings_pending')}</p>
            <p className="font-display text-2xl font-bold text-amber-400 tabular-nums">{formatMoney(pendingKobo, currency)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('paid_weekly')}</p>
          </div>
        </div>
      </motion.div>

      {/* ── Weekly bar chart ── */}
      {allDeliveries.length > 0 && (
        <motion.div
          custom={2} variants={stagger} initial="hidden" animate="visible"
          className="mb-4"
        >
          <WeeklyBarChart orders={allDeliveries} />
        </motion.div>
      )}

      {/* ── 30-day performance metrics ── */}
      <motion.div
        custom={3} variants={stagger} initial="hidden" animate="visible"
        className="mb-4"
      >
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t('last_30_days')}</p>
        {loadingMetrics ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Bike size={17} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('stat_deliveries')}</p>
                <p className="font-bold text-zinc-100 text-lg">{metrics?.deliveriesCount ?? rider?.totalDeliveries ?? 0}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Clock size={17} className="text-secondary" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('avg_time')}</p>
                <p className="font-bold text-zinc-100 text-lg">
                  {metrics?.avgDeliveryMinutes ? `${Math.round(metrics.avgDeliveryMinutes)}m` : '—'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Target size={17} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('on_time')}</p>
                <p className="font-bold text-zinc-100 text-lg">
                  {metrics ? `${Math.round(metrics.onTimeRate * 100)}%` : '—'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <TrendingUp size={17} className="text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">{t('cancel_rate')}</p>
                <p className="font-bold text-zinc-100 text-lg">
                  {metrics ? `${Math.round(metrics.cancellationRate * 100)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Payout CTA ── */}
      <motion.button
        custom={4} variants={stagger} initial="hidden" animate="visible"
        whileTap={{ scale: 0.97 }}
        onClick={() => void navigate('/payouts')}
        className="w-full flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 cursor-pointer hover:border-zinc-700 transition-colors mb-4"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-zinc-200">{t('request_payout')}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatMoney(liveRider?.earnings.pendingKobo ?? 0, 'NGN')} {t('pending_tap_to_request')}
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-600" />
      </motion.button>

      {/* ── Delivery history ── */}
      <motion.div
        custom={5} variants={stagger} initial="hidden" animate="visible"
      >
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{t('delivery_history')}</p>

        {allDeliveries.length === 0 && !historyFetching ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-zinc-800 bg-zinc-900">
            <Package size={32} className="text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">{t('no_deliveries_yet')}</p>
            <p className="text-xs text-zinc-600 mt-1">{t('deliveries_appear_here')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allDeliveries.map((order) => {
              const earned = order.pricing.deliveryFee + (order.pricing.tip ?? 0)
              const hasTip = (order.pricing.tip ?? 0) > 0
              const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
              return (
                <div
                  key={order._id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                        <Bike size={13} className="text-primary" />
                      </div>
                      <span className="text-xs font-mono text-zinc-500">{order.orderNumber}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">
                        +{formatMoney(earned, order.currency)}
                      </p>
                      {hasTip && (
                        <p className="text-[10px] text-secondary mt-0.5">
                          {t('incl_tip', { amount: formatMoney(order.pricing.tip, order.currency) })}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 truncate mb-1">
                    {order.deliveryAddress.street}, {order.deliveryAddress.city}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <span>{formatRelativeDate(order.updatedAt)}</span>
                    <span>·</span>
                    <span>{t('item_count', { count: itemCount })}</span>
                  </div>
                </div>
              )
            })}

            {historyData && historyPage < historyData.meta.totalPages && (
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyFetching}
                className="w-full py-3 text-sm font-medium text-zinc-400 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors disabled:opacity-50"
              >
                {historyFetching ? t('loading') : t('load_more')}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
