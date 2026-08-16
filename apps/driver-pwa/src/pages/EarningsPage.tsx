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

function StatCard({
  label,
  value,
  sub,
  accent = false,
  delay = 0,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  delay?: number
}) {
  return (
    <motion.div
      custom={delay}
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
    >
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <p className={`font-display text-xl font-bold ${accent ? 'text-primary' : 'text-zinc-100'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
    </motion.div>
  )
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

export default function EarningsPage() {
  const { t } = useTranslation('rider')
  const navigate = useNavigate()
  const { rider, setRider } = useRiderStore()
  const [historyPage, setHistoryPage] = useState(1)
  const [allDeliveries, setAllDeliveries] = useState<Order[]>([])

  // Always fetch fresh profile on mount so earnings reflect the latest completed delivery
  const { data: freshProfile } = useQuery({
    queryKey: ['rider-profile'],
    queryFn: () => ridersApi.getProfile().then((r) => r.data.data),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Sync fresh profile into the store so other pages (AvailableJobs strip, Profile) also update
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

      {/* Earnings summary */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label={t('earnings_total')} value={formatMoney(totalKobo, currency)} delay={1} />
        <StatCard label={t('earnings_pending')} value={formatMoney(pendingKobo, currency)} accent delay={2} sub="Processes weekly" />
      </div>

      {/* Performance metrics */}
      <motion.div
        custom={3} variants={stagger} initial="hidden" animate="visible"
        className="mb-4"
      >
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Last 30 days
        </p>
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
                <p className="text-xs text-zinc-500">Deliveries</p>
                <p className="font-bold text-zinc-100 text-lg">{metrics?.deliveriesCount ?? rider?.totalDeliveries ?? 0}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <Clock size={17} className="text-secondary" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Avg time</p>
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
                <p className="text-xs text-zinc-500">On time</p>
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
                <p className="text-xs text-zinc-500">Cancel rate</p>
                <p className="font-bold text-zinc-100 text-lg">
                  {metrics ? `${Math.round(metrics.cancellationRate * 100)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Payout CTA */}
      <motion.button
        custom={4} variants={stagger} initial="hidden" animate="visible"
        whileTap={{ scale: 0.97 }}
        onClick={() => void navigate('/payouts')}
        className="w-full flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 cursor-pointer hover:border-zinc-700 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
          <TrendingUp size={18} className="text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-zinc-200">Payouts</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatMoney(liveRider?.earnings.pendingKobo ?? 0, 'NGN')} pending · Tap to request
          </p>
        </div>
        <ChevronRight size={16} className="text-zinc-600" />
      </motion.button>

      {/* Delivery history */}
      <motion.div
        custom={5} variants={stagger} initial="hidden" animate="visible"
        className="mt-4"
      >
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Delivery history
        </p>

        {allDeliveries.length === 0 && !historyFetching ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-zinc-800 bg-zinc-900">
            <Package size={32} className="text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No deliveries yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allDeliveries.map((order) => (
              <div
                key={order._id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3"
              >
                <div className="h-9 w-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                  <Bike size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{order.orderNumber}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatRelativeDate(order.updatedAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-green-400">
                    +{formatMoney(order.pricing.deliveryFee + (order.pricing.tip ?? 0), order.currency)}
                  </p>
                </div>
              </div>
            ))}

            {historyData && historyPage < historyData.meta.totalPages && (
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyFetching}
                className="w-full py-3 text-sm font-medium text-zinc-400 border border-zinc-800 rounded-2xl cursor-pointer hover:border-zinc-700 transition-colors disabled:opacity-50"
              >
                {historyFetching ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
