import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, UtensilsCrossed, Heart, ClipboardList, User } from 'lucide-react'
import { ROUTES } from '../../router/routes'
import { useAuthStore } from '../../store/auth.store'

const ALL_TABS = [
  { labelKey: 'nav.home',    icon: Home,             to: ROUTES.HOME,        authRequired: false },
  { labelKey: 'nav.browse',  icon: UtensilsCrossed,  to: ROUTES.RESTAURANTS, authRequired: false },
  { labelKey: 'nav.saved',   icon: Heart,             to: ROUTES.FAVORITES,   authRequired: true  },
  { labelKey: 'nav.orders',  icon: ClipboardList,    to: ROUTES.ORDERS,      authRequired: false },
  { labelKey: 'nav.profile', icon: User,             to: ROUTES.PROFILE,     authRequired: false },
] as const

export function BottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const tabs = ALL_TABS.filter((tab) => !tab.authRequired || isAuthenticated)

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 h-16 bg-white border-t border-gray-100 flex"
      aria-label={t('nav.mainNavigation', 'Main navigation')}
    >
      {tabs.map(({ labelKey, icon: Icon, to }) => {
        const active =
          to === ROUTES.HOME
            ? pathname === ROUTES.HOME
            : pathname.startsWith(to)

        const isSaved = to === ROUTES.FAVORITES

        return (
          <Link
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-150 min-h-[44px] ${
              active ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <Icon
              className="w-5 h-5"
              strokeWidth={active ? 2.5 : 1.5}
              {...(isSaved && active ? { fill: 'currentColor' } : {})}
            />
            <span className="text-[10px] font-medium">{t(labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
