import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Bike, LogOut, ChevronRight, Shield, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
import { VehicleType } from '@grandxl/types'
import { ROUTES } from '../router/routes'
import { formatMoney } from '@grandxl/utils'

const vehicleLabel: Record<VehicleType, string> = {
  [VehicleType.BICYCLE]:    'Bicycle',
  [VehicleType.MOTORCYCLE]: 'Motorcycle',
  [VehicleType.CAR]:        'Car',
}

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.22 } }),
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { rider, setRider } = useRiderStore()

  function signOut() {
    clearAuth()
    setRider(null)
    void navigate(ROUTES.LOGIN, { replace: true })
    toast.success('Signed out successfully')
  }

  const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join('') || '?'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Rider'

  return (
    <div className="min-h-full px-4 py-4 pb-8">
      {/* Avatar hero */}
      <motion.div
        custom={0} variants={stagger} initial="hidden" animate="visible"
        className="mb-5 flex items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
            <span className="font-display text-2xl font-bold text-primary">{initials}</span>
          </div>
          {rider?.isVerified && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-zinc-900 flex items-center justify-center">
              <Shield size={10} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-zinc-100 text-lg leading-tight truncate">{fullName}</p>
          <p className="text-sm text-zinc-500 mt-0.5">{user?.phone}</p>
          {rider?.isVerified && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              <Shield size={9} /> Verified rider
            </span>
          )}
        </div>
      </motion.div>

      {/* Stats row */}
      {rider && (
        <motion.div
          custom={1} variants={stagger} initial="hidden" animate="visible"
          className="mb-4 grid grid-cols-3 gap-2.5"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={13} className="text-yellow-400" />
            </div>
            <p className="font-display text-xl font-bold text-zinc-100">{rider.rating.toFixed(1)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Rating</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bike size={13} className="text-primary" />
            </div>
            <p className="font-display text-xl font-bold text-zinc-100">{rider.totalDeliveries}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Deliveries</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet size={13} className="text-green-400" />
            </div>
            <p className="font-display text-base font-bold text-zinc-100 truncate">
              {formatMoney(rider.earnings.totalKobo ?? 0, 'NGN').replace('₦', '₦')}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Total earned</p>
          </div>
        </motion.div>
      )}

      {/* Vehicle info */}
      {rider && (
        <motion.div
          custom={2} variants={stagger} initial="hidden" animate="visible"
          className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900"
        >
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Vehicle</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-zinc-500">Type</span>
            <span className="text-zinc-200 font-medium">{vehicleLabel[rider.vehicleType]}</span>
          </div>
          {rider.vehiclePlate && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60 text-sm">
              <span className="text-zinc-500">Plate number</span>
              <span className="font-mono text-zinc-200 font-semibold tracking-widest">{rider.vehiclePlate}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Navigation items */}
      <motion.div
        custom={3} variants={stagger} initial="hidden" animate="visible"
        className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <button
          onClick={() => void navigate(ROUTES.PAYOUTS)}
          className="flex w-full items-center gap-3 px-4 py-4 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60 cursor-pointer border-b border-zinc-800/60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Wallet size={15} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Payouts</span>
          <ChevronRight size={15} className="text-zinc-600" />
        </button>
        <button
          onClick={() => void navigate(ROUTES.EARNINGS)}
          className="flex w-full items-center gap-3 px-4 py-4 text-sm text-zinc-300 transition-colors hover:bg-zinc-800/60 cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
            <Star size={15} className="text-zinc-400" />
          </div>
          <span className="flex-1 text-left">Earnings & metrics</span>
          <ChevronRight size={15} className="text-zinc-600" />
        </button>
      </motion.div>

      {/* Sign out */}
      <motion.button
        custom={4} variants={stagger} initial="hidden" animate="visible"
        whileTap={{ scale: 0.97 }}
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-900/40 bg-red-950/20 py-4 text-sm font-semibold text-red-500 transition-colors hover:bg-red-950/40 cursor-pointer"
        style={{ touchAction: 'manipulation', minHeight: '52px' }}
      >
        <LogOut size={16} />
        Sign out
      </motion.button>
    </div>
  )
}
