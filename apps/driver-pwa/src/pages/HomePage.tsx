import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  Star, Bike, TrendingUp, Wallet, ChevronRight,
  Navigation, Package, Zap, Clock,
} from 'lucide-react'
import { formatMoney } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'

const stagger: Variants = {
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

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { rider, isOnline, activeOrder } = useRiderStore()

  // Auto-navigate to the active delivery if one is in progress (e.g. after refresh)
  useEffect(() => {
    if (activeOrder) {
      void navigate(`/delivery/${activeOrder._id}`, { replace: true })
    }
  }, [activeOrder, navigate])

  const firstName = user?.firstName ?? 'Rider'
  const totalKobo = rider?.earnings.totalKobo ?? 0
  const pendingKobo = rider?.earnings.pendingKobo ?? 0

  return (
    <div className="min-h-full px-4 py-4 space-y-3 pb-8">
      {/* Greeting */}
      <motion.div custom={0} variants={stagger} initial="hidden" animate="visible">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {greeting()}
        </p>
        <h1 className="font-display text-2xl font-bold text-zinc-100 mt-0.5 leading-tight">
          {firstName} 👋
        </h1>
      </motion.div>

      {/* Active order CTA — shown when rider has an ongoing delivery */}
      {activeOrder && (
        <motion.button
          custom={0.5} variants={stagger} initial="hidden" animate="visible"
          whileTap={{ scale: 0.97 }}
          onClick={() => void navigate(`/delivery/${activeOrder._id}`)}
          className="w-full flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/8 p-4 text-left cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
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

      {/* Earnings cards row */}
      <motion.div
        custom={1} variants={stagger} initial="hidden" animate="visible"
        className="grid grid-cols-2 gap-2.5"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet size={13} className="text-green-400" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Total earned</p>
          </div>
          <p className="font-display text-lg font-bold text-zinc-100 leading-tight truncate">
            {formatMoney(totalKobo, 'NGN')}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock size={13} className="text-amber-400" />
            </div>
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">Pending</p>
          </div>
          <p className="font-display text-lg font-bold text-zinc-100 leading-tight truncate">
            {formatMoney(pendingKobo, 'NGN')}
          </p>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        custom={2} variants={stagger} initial="hidden" animate="visible"
        className="grid grid-cols-3 gap-2.5"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
          <Star size={14} className="text-yellow-400 mx-auto mb-1.5" />
          <p className="font-display text-xl font-bold text-zinc-100">
            {rider ? rider.rating.toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Rating</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
          <Bike size={14} className="text-primary mx-auto mb-1.5" />
          <p className="font-display text-xl font-bold text-zinc-100">
            {rider?.totalDeliveries ?? 0}
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Deliveries</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
          <TrendingUp size={14} className="text-blue-400 mx-auto mb-1.5" />
          <p className="font-display text-xl font-bold text-zinc-100">0%</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Cancel rate</p>
        </div>
      </motion.div>

      {/* Online status card */}
      <motion.div
        custom={3} variants={stagger} initial="hidden" animate="visible"
        className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
          isOnline
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-zinc-800 bg-zinc-900'
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

      {/* Quick actions */}
      <motion.div
        custom={4} variants={stagger} initial="hidden" animate="visible"
        className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <button
          onClick={() => void navigate(ROUTES.EARNINGS)}
          className="flex w-full items-center gap-3 px-4 py-4 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800/60"
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
          className="flex w-full items-center gap-3 px-4 py-4 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-800/60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Wallet size={14} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Payouts</span>
          <ChevronRight size={14} className="text-zinc-600" />
        </button>
        <button
          onClick={() => void navigate(ROUTES.AVAILABLE_JOBS)}
          className="flex w-full items-center gap-3 px-4 py-4 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors cursor-pointer"
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
