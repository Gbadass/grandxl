import { Bell, Bike } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useRiderStore } from '../../store/rider.store'
import { formatMoney } from '@grandxl/utils'

export function TopBar() {
  const { isOnline, rider, pendingJobs } = useRiderStore()
  const { t } = useTranslation(['rider', 'common'])
  const hasPendingJobs = pendingJobs.length > 0
  const pendingKobo = rider?.earnings.pendingKobo ?? 0

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-md safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Bike size={16} className="text-white" />
          </div>
          <div>
            <span className="font-display text-sm font-bold tracking-tight text-zinc-100">GrandXL</span>
            <span className="ml-1.5 text-xs text-zinc-600">Rider</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Pending earnings pill — only when there's something meaningful */}
          {pendingKobo > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1"
            >
              <span className="text-[10px] font-bold text-green-400 tabular-nums">
                {formatMoney(pendingKobo, 'NGN')}
              </span>
            </motion.div>
          )}

          {/* Notification bell — lights up when there are pending jobs */}
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-zinc-800 cursor-pointer"
            style={{ touchAction: 'manipulation' }}
            aria-label={t('common:notifications')}
          >
            <Bell
              size={17}
              className={hasPendingJobs ? 'text-amber-400' : 'text-zinc-500'}
              strokeWidth={hasPendingJobs ? 2.5 : 1.75}
            />
            {hasPendingJobs && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary border border-zinc-950"
              />
            )}
          </button>

          {/* Status pill */}
          <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
            isOnline ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20' : 'bg-zinc-800 text-zinc-500'
          }`}>
            <motion.span
              className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-zinc-600'}`}
              animate={isOnline ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {isOnline ? t('rider:online') : t('rider:offline_status')}
          </div>
        </div>
      </div>
    </header>
  )
}
