import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  Star, Bike, Wallet, ChevronRight,
  Navigation, Package, Zap, Clock, TrendingUp, Target,
} from 'lucide-react'
import { formatMoney } from '@grandxl/utils'
import { ridersApi } from '@grandxl/api-client'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'

const fade: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.22 },
  }),
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** SVG ring that fills clockwise from 0–100% */
function Ring({
  pct,
  size = 48,
  strokeWidth = 4,
  color = '#E84B3A',
  bg = '#27272a',
}: {
  pct: number
  size?: number
  strokeWidth?: number
  color?: string
  bg?: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 1))
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} stroke={bg} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" strokeWidth={strokeWidth} stroke={color}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.4 }}
      />
    </svg>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { rider, isOnline, activeOrder } = useRiderStore()

  useEffect(() => {
    if (activeOrder) {
      void navigate(`/delivery/${activeOrder._id}`, { replace: true })
    }
  }, [activeOrder, navigate])

  const { data: metrics } = useQuery({
    queryKey: ['rider-metrics-home'],
    queryFn: () => ridersApi.getMetrics(30).then((r) => r.data.data),
    staleTime: 1000 * 60 * 10,
    enabled: !!rider,
  })

  const firstName = user?.firstName ?? 'Rider'
  const totalKobo = rider?.earnings.totalKobo ?? 0
  const pendingKobo = rider?.earnings.pendingKobo ?? 0
  const onTimeRate = metrics?.onTimeRate ?? 0
  const cancelRate = metrics?.cancellationRate ?? 0
  const deliveryCount = metrics?.deliveriesCount ?? rider?.totalDeliveries ?? 0

  return (
    <div className="min-h-full px-4 py-4 space-y-3 pb-8">

      {/* ── Greeting ── */}
      <motion.div custom={0} variants={fade} initial="hidden" animate="visible">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{greeting()}</p>
        <h1 className="font-display text-2xl font-bold text-zinc-100 mt-0.5 leading-tight">
          {firstName} 👋
        </h1>
      </motion.div>

      {/* ── Active order banner ── */}
      {activeOrder && (
        <motion.button
          custom={0.5} variants={fade} initial="hidden" animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={() => void navigate(`/delivery/${activeOrder._id}`)}
          className="w-full flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/8 p-4 text-left cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
              <Navigation size={22} className="text-primary" />
            </motion.div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-primary"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <p className="text-[10px] font-bold text-primary uppercase tracking-wide">Active delivery</p>
            </div>
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {activeOrder.deliveryAddress.street}, {activeOrder.deliveryAddress.city}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{activeOrder.orderNumber}</p>
          </div>
          <ChevronRight size={16} className="text-primary shrink-0" />
        </motion.button>
      )}

      {/* ── Earnings hero card ── */}
      <motion.div
        custom={1} variants={fade} initial="hidden" animate="visible"
        className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 overflow-hidden relative"
      >
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Earnings overview</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-5 w-5 rounded-md bg-green-500/10 flex items-center justify-center">
                <Wallet size={11} className="text-green-400" />
              </div>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Total earned</p>
            </div>
            <p className="font-display text-2xl font-bold text-zinc-100 leading-tight tabular-nums">
              {formatMoney(totalKobo, 'NGN')}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-5 w-5 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Clock size={11} className="text-amber-400" />
              </div>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Pending</p>
            </div>
            <p className="font-display text-2xl font-bold text-amber-400 leading-tight tabular-nums">
              {formatMoney(pendingKobo, 'NGN')}
            </p>
            {pendingKobo > 0 && (
              <p className="text-[10px] text-zinc-600 mt-0.5">Paid out weekly</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Performance rings (30-day) ── */}
      <motion.div
        custom={2} variants={fade} initial="hidden" animate="visible"
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">30-day performance</p>
          {deliveryCount > 0 && (
            <span className="text-[10px] text-zinc-600 font-medium">{deliveryCount} deliveries</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* Rating */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Ring pct={rider ? rider.rating / 5 : 0} color="#facc15" bg="#27272a" size={56} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Star size={14} className="text-yellow-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-bold text-zinc-100">
                {rider ? rider.rating.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-zinc-600">Rating</p>
            </div>
          </div>

          {/* On-time rate */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Ring pct={onTimeRate} color="#22c55e" bg="#27272a" size={56} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Target size={14} className="text-green-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-bold text-zinc-100">
                {metrics ? `${Math.round(onTimeRate * 100)}%` : '—'}
              </p>
              <p className="text-[10px] text-zinc-600">On time</p>
            </div>
          </div>

          {/* Completion rate (inverse of cancel rate) */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Ring pct={1 - cancelRate} color="#E84B3A" bg="#27272a" size={56} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Bike size={14} className="text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-bold text-zinc-100">
                {metrics ? `${Math.round((1 - cancelRate) * 100)}%` : '—'}
              </p>
              <p className="text-[10px] text-zinc-600">Completion</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Online status card ── */}
      <motion.div
        custom={3} variants={fade} initial="hidden" animate="visible"
        className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
          isOnline ? 'border-green-500/20 bg-green-500/5' : 'border-zinc-800 bg-zinc-900'
        }`}
      >
        <div className={`relative h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
          isOnline ? 'bg-green-500/20' : 'bg-zinc-800'
        }`}>
          <Bike size={18} className={isOnline ? 'text-green-400' : 'text-zinc-500'} />
          {isOnline && (
            <motion.div
              className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-400 border-2 border-zinc-950"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isOnline ? 'text-green-400' : 'text-zinc-400'}`}>
            {isOnline ? 'Online — receiving jobs' : 'Offline'}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {isOnline ? 'Switch to Jobs tab to see incoming orders' : 'Go to Jobs tab to go online'}
          </p>
        </div>
        <Zap size={16} className={isOnline ? 'text-green-400' : 'text-zinc-700'} />
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div
        custom={4} variants={fade} initial="hidden" animate="visible"
        className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-zinc-800/60">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Quick actions</p>
        </div>

        <button
          onClick={() => void navigate(ROUTES.EARNINGS)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800/60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Earnings & metrics</span>
          <ChevronRight size={14} className="text-zinc-600" />
        </button>

        <button
          onClick={() => void navigate(ROUTES.PAYOUTS)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800/60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Wallet size={14} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Request payout</span>
          {pendingKobo > 0 && (
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full mr-1">
              {formatMoney(pendingKobo, 'NGN')}
            </span>
          )}
          <ChevronRight size={14} className="text-zinc-600" />
        </button>

        <button
          onClick={() => void navigate(ROUTES.EARNINGS)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800/60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Delivery history</span>
          <ChevronRight size={14} className="text-zinc-600" />
        </button>

        <button
          onClick={() => void navigate(ROUTES.AVAILABLE_JOBS)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Package size={14} className="text-primary" />
          </div>
          <span className="flex-1 text-left font-medium text-primary">Find jobs now</span>
          <ChevronRight size={14} className="text-primary" />
        </button>
      </motion.div>
    </div>
  )
}
