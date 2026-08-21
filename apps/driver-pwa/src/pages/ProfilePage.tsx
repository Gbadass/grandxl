import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Star, Bike, LogOut, ChevronRight, Shield, Wallet,
  TrendingUp, HelpCircle, FileText, Info, Phone,
  type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ridersApi, authApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
import { clearRiderToken } from '../lib/riderAuth'
import { VehicleType } from '@grandxl/types'
import { ROUTES } from '../router/routes'
import { formatMoney } from '@grandxl/utils'

const vehicleLabelKey: Record<VehicleType, string> = {
  [VehicleType.BICYCLE]:    'vehicle_bicycle',
  [VehicleType.MOTORCYCLE]: 'vehicle_motorcycle',
  [VehicleType.CAR]:        'vehicle_car',
}

const vehicleIcon: Record<VehicleType, string> = {
  [VehicleType.BICYCLE]:    '🚲',
  [VehicleType.MOTORCYCLE]: '🏍️',
  [VehicleType.CAR]:        '🚗',
}

const stagger = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.22 } }),
}

function SectionRow({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  onClick,
  danger = false,
}: {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  label: string
  value?: string
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors cursor-pointer hover:bg-zinc-800/50 disabled:cursor-default disabled:hover:bg-transparent ${
        danger ? 'text-red-400' : 'text-zinc-300'
      }`}
      style={{ touchAction: 'manipulation' }}
    >
      <div className={`h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={14} className={iconColor} />
      </div>
      <span className="flex-1 text-left">{label}</span>
      {value && <span className="text-xs text-zinc-500 mr-1">{value}</span>}
      {onClick && <ChevronRight size={14} className={danger ? 'text-red-700' : 'text-zinc-600'} />}
    </button>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { user, clearAuth } = useAuthStore()
  const { rider, setRider, setActiveOrder, clearPendingJobs } = useRiderStore()

  async function signOut() {
    // Clear all rider state first so no in-flight effects re-navigate to /delivery
    setActiveOrder(null)
    clearPendingJobs()
    setRider(null)
    clearAuth()
    clearRiderToken()
    // Fire-and-forget — invalidate the refresh token on the server
    void authApi.logout().catch(() => undefined)
    void navigate(ROUTES.LOGIN, { replace: true })
    toast.success(t('signed_out'))
  }

  // Always fetch fresh profile on mount so verified status / name are up to date
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

  const initials = [user?.firstName?.charAt(0), user?.lastName?.charAt(0)].filter(Boolean).join('') || '?'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Rider'

  return (
    <div className="min-h-full px-4 py-4 pb-8">

      {/* ── Avatar hero ── */}
      <motion.div
        custom={0} variants={stagger} initial="hidden" animate="visible"
        className="mb-4 flex items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="relative">
          {/* Avatar with gradient ring when verified */}
          <div className={`p-0.5 rounded-2xl ${liveRider?.isVerified ? 'bg-gradient-to-br from-green-400 to-green-600' : ''}`}>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
              <span className="font-display text-2xl font-bold text-primary">{initials}</span>
            </div>
          </div>
          {liveRider?.isVerified && (
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-zinc-900 flex items-center justify-center">
              <Shield size={10} className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-zinc-100 text-lg leading-tight truncate">{fullName}</p>
          <p className="text-sm text-zinc-500 mt-0.5">{user?.phone}</p>
          {liveRider?.isVerified ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              <Shield size={9} /> {t('verified_rider_badge')}
            </span>
          ) : liveRider ? (
            <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              {t('pending_verification_badge')}
            </span>
          ) : null}
        </div>
      </motion.div>

      {/* ── Stats row ── */}
      {liveRider && (
        <motion.div
          custom={1} variants={stagger} initial="hidden" animate="visible"
          className="mb-4 grid grid-cols-3 gap-2.5"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <Star size={13} className="text-yellow-400 mx-auto mb-1" />
            <p className="font-display text-xl font-bold text-zinc-100">{liveRider.rating.toFixed(1)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('stat_rating')}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <Bike size={13} className="text-primary mx-auto mb-1" />
            <p className="font-display text-xl font-bold text-zinc-100">{liveRider.totalDeliveries}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('stat_deliveries')}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5 text-center">
            <Wallet size={13} className="text-green-400 mx-auto mb-1" />
            <p className="font-display text-sm font-bold text-zinc-100 truncate leading-tight">
              {formatMoney(liveRider.earnings.totalKobo ?? 0, 'NGN')}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{t('stat_total_earned')}</p>
          </div>
        </motion.div>
      )}

      {/* ── Vehicle info ── */}
      {liveRider && (
        <motion.div
          custom={2} variants={stagger} initial="hidden" animate="visible"
          className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{t('section_vehicle')}</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-2xl">{vehicleIcon[liveRider.vehicleType]}</span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{t(vehicleLabelKey[liveRider.vehicleType])}</p>
              {liveRider.vehiclePlate && (
                <p className="text-xs font-mono text-zinc-500 tracking-widest mt-0.5">{liveRider.vehiclePlate}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Account section ── */}
      <motion.div
        custom={3} variants={stagger} initial="hidden" animate="visible"
        className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{t('section_account')}</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          <SectionRow
            icon={Wallet}
            iconColor="text-zinc-400"
            iconBg="bg-zinc-800"
            label={t('section_payouts')}
            onClick={() => void navigate(ROUTES.PAYOUTS)}
          />
          <SectionRow
            icon={TrendingUp}
            iconColor="text-zinc-400"
            iconBg="bg-zinc-800"
            label={t('section_earnings_metrics')}
            onClick={() => void navigate(ROUTES.EARNINGS)}
          />
        </div>
      </motion.div>

      {/* ── Support section ── */}
      <motion.div
        custom={4} variants={stagger} initial="hidden" animate="visible"
        className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">{t('section_support')}</p>
        </div>
        <div className="divide-y divide-zinc-800/60">
          <SectionRow
            icon={Phone}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            label={t('contact_support')}
            onClick={() => {
              window.open('tel:+234800GRANDXL', '_self')
            }}
          />
          <SectionRow
            icon={HelpCircle}
            iconColor="text-zinc-400"
            iconBg="bg-zinc-800"
            label={t('help_centre')}
            onClick={() => toast(t('help_coming_soon'))}
          />
          <SectionRow
            icon={FileText}
            iconColor="text-zinc-400"
            iconBg="bg-zinc-800"
            label={t('terms_conditions')}
            onClick={() => toast(t('opening_terms'))}
          />
          <SectionRow
            icon={Info}
            iconColor="text-zinc-400"
            iconBg="bg-zinc-800"
            label={t('app_version')}
            value="1.0.0"
          />
        </div>
      </motion.div>

      {/* ── Sign out ── */}
      <motion.button
        custom={5} variants={stagger} initial="hidden" animate="visible"
        whileTap={{ scale: 0.97 }}
        onClick={() => void signOut()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-900/40 bg-red-950/20 py-4 text-sm font-semibold text-red-500 transition-colors hover:bg-red-950/40 cursor-pointer"
        style={{ touchAction: 'manipulation', minHeight: '52px' }}
      >
        <LogOut size={16} />
        {t('sign_out')}
      </motion.button>
    </div>
  )
}
