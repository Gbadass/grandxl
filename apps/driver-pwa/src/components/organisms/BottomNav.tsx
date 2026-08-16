import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Briefcase, TrendingUp, User } from 'lucide-react'
import { ROUTES } from '../../router/routes'

const navItems = [
  { to: ROUTES.HOME,           label: 'Home',     Icon: Home },
  { to: ROUTES.AVAILABLE_JOBS, label: 'Jobs',     Icon: Briefcase },
  { to: ROUTES.EARNINGS,       label: 'Earnings', Icon: TrendingUp },
  { to: ROUTES.PROFILE,        label: 'Profile',  Icon: User },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-md safe-bottom">
      {navItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === ROUTES.HOME}
          className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-2"
        >
          {({ isActive }) => (
            <>
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
