import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Briefcase, TrendingUp, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ROUTES } from '../../router/routes'
import { useRiderStore } from '../../store/rider.store'

export function BottomNav() {
  const pendingCount = useRiderStore((s) => s.pendingJobs.length)
  const { t } = useTranslation('rider')

  const navItems = [
    { to: ROUTES.HOME,           label: t('home'),     Icon: Home,       badge: 0 },
    { to: ROUTES.AVAILABLE_JOBS, label: t('jobs'),     Icon: Briefcase,  badge: pendingCount },
    { to: ROUTES.EARNINGS,       label: t('earnings'), Icon: TrendingUp, badge: 0 },
    { to: ROUTES.PROFILE,        label: t('profile'),  Icon: User,       badge: 0 },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-md safe-bottom">
      {navItems.map(({ to, label, Icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={to === ROUTES.HOME}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-2"
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <motion.div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive ? 'bg-primary/20' : ''
                  }`}
                  animate={isActive ? { scale: [0.8, 1] } : {}}
                  transition={{ duration: 0.2 }}
                >
                  <Icon
                    size={19}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={isActive ? 'text-primary' : 'text-zinc-500'}
                  />
                </motion.div>

                {/* Job count badge */}
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.div
                      key="badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary border border-zinc-950"
                    >
                      <span className="text-[9px] font-bold text-white leading-none">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-zinc-600'}`}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
