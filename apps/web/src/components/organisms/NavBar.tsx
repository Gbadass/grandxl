import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, MapPin, Bell, ShoppingBag, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../features/cart/store/cart.store'
import { useLocationStore } from '../../store/location.store'
import { LocationPickerSheet } from './LocationPickerSheet'
import { ROUTES } from '../../router/routes'

export function NavBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const city = useLocationStore((s) => s.city)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)

  return (
    <>
      <header className="hidden md:flex fixed inset-x-0 top-0 z-40 h-16 bg-white shadow-sm items-center px-6 gap-4">
        {/* Logo */}
        <Link
          to={ROUTES.HOME}
          className="font-display font-bold text-xl text-primary shrink-0 cursor-pointer hover:opacity-80 transition-opacity duration-150"
        >
          GrandXL
        </Link>

        {/* Search */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 cursor-pointer hover:bg-gray-200 transition-colors duration-150">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-400 text-sm select-none">
              {t('nav.searchPlaceholder', 'Search restaurants or dishes...')}
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Location button — opens picker sheet */}
          <button
            type="button"
            onClick={() => setLocationSheetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
            aria-label={t('nav.changeLocation', 'Change location')}
          >
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-gray-700 max-w-[110px] truncate">
              {city ?? t('nav.location', 'Set location')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <Link
            to={ROUTES.NOTIFICATIONS}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
            aria-label={t('nav.notifications', 'Notifications')}
          >
            <Bell className="w-5 h-5 text-gray-600" />
          </Link>

          <Link
            to={ROUTES.CART}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
            aria-label={t('nav.cart', 'Cart')}
          >
            <ShoppingBag className="w-5 h-5 text-gray-600" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <Link
              to={ROUTES.PROFILE}
              className="ml-1 w-9 h-9 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity duration-150"
              aria-label={t('nav.profile', 'My profile')}
            >
              <span className="text-white text-sm font-semibold select-none">
                {user.firstName?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </Link>
          ) : (
            <Link
              to={ROUTES.LOGIN}
              className="ml-1 px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors duration-150 cursor-pointer"
            >
              {t('auth.login', 'Sign In')}
            </Link>
          )}
        </div>
      </header>

      <LocationPickerSheet
        isOpen={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />
    </>
  )
}
