import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useCartStore } from '../../features/cart/store/cart.store'
import { formatMoney } from '@grandxl/utils'
import { ROUTES } from '../../router/routes'

export function CartFab() {
  const { t } = useTranslation()
  const items = useCartStore((s) => s.items)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const total = items.reduce((sum, i) => sum + i.itemTotal, 0)

  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="md:hidden fixed bottom-[76px] inset-x-4 z-30"
        >
          <Link
            to={ROUTES.CART}
            className="flex items-center justify-between bg-primary text-white rounded-2xl px-4 py-3 shadow-lg shadow-primary/30 cursor-pointer active:scale-[0.98] transition-transform duration-100"
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 rounded-xl p-1.5">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">
                {t('cart.itemCount', '{{count}} item', { count: itemCount })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{formatMoney(total, 'NGN')}</span>
              <span className="text-white/70 text-sm">{t('cart.viewCart', 'View Cart →')}</span>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
