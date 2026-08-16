import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ShoppingBag, Minus, Plus, Trash2, ChevronRight, Tag } from 'lucide-react'
import { useCartStore } from '../features/cart/store/cart.store'
import { useAuthStore } from '../store/auth.store'
import { formatMoney } from '@grandxl/utils'
import { ROUTES } from '../router/routes'

const SERVICE_FEE_RATE = 0.05

function EmptyCart() {
  const { t } = useTranslation(['cart', 'common'])
  const navigate = useNavigate()

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-6 py-20 text-center"
    >
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <ShoppingBag size={36} className="text-gray-300" />
      </div>
      <h2 className="text-lg font-display font-bold text-gray-900">{t('cart:empty')}</h2>
      <p className="mt-1.5 text-sm text-gray-500">{t('cart:emptySubtitle')}</p>
      <button
        onClick={() => void navigate(ROUTES.RESTAURANTS)}
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white cursor-pointer hover:bg-primary/90 transition-colors"
        style={{ minHeight: '44px' }}
      >
        {t('common:browse', 'Browse restaurants')}
      </button>
    </motion.div>
  )
}

export default function CartPage() {
  const { t } = useTranslation(['cart', 'common'])
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { items, updateQuantity, removeItem } = useCartStore()
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)

  const currency = 'NGN'
  const subtotal = items.reduce((acc, item) => acc + item.itemTotal, 0)
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE)
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0
  const total = subtotal + serviceFee - discount

  function handleCheckout() {
    if (!isAuthenticated) {
      void navigate(ROUTES.LOGIN, { state: { returnTo: ROUTES.CART } })
      return
    }
    void navigate(ROUTES.CHECKOUT)
  }

  if (items.length === 0) return <EmptyCart />

  return (
    <div className="max-w-2xl mx-auto px-4 pb-36">
      {/* Header */}
      <div className="py-4">
        <h1 className="font-display font-bold text-xl text-gray-900">{t('cart:title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Item list */}
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.menuItemId}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-16 w-16 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                  <ShoppingBag size={20} className="text-gray-300" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                {item.selectedVariants.length > 0 && (
                  <p className="text-xs text-gray-400 truncate">
                    {item.selectedVariants.map((v) => v.optionName).join(', ')}
                  </p>
                )}
                <p className="mt-0.5 text-sm font-semibold text-primary">
                  {formatMoney(item.itemTotal, currency)}
                </p>
              </div>

              {/* Quantity controls — 44px touch targets */}
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={{ duration: 0.07 }}
                  onClick={() =>
                    item.quantity === 1
                      ? removeItem(item.menuItemId)
                      : updateQuantity(item.menuItemId, item.quantity - 1)
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 cursor-pointer text-gray-600 hover:border-red-400 hover:text-red-500 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  aria-label={item.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                >
                  {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                </motion.button>

                <motion.span layout className="w-5 text-center text-sm font-semibold text-gray-900">
                  {item.quantity}
                </motion.span>

                <motion.button
                  whileTap={{ scale: 0.85 }}
                  transition={{ duration: 0.07 }}
                  onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary cursor-pointer text-white hover:bg-primary/90 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  aria-label="Increase quantity"
                >
                  <Plus size={13} />
                </motion.button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {/* Promo code */}
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder={t('cart:coupon')}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30 transition"
          />
        </div>
        <button
          onClick={() => { if (promoCode.trim()) setPromoApplied(true) }}
          className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold cursor-pointer hover:bg-gray-700 transition-colors"
          style={{ minHeight: '44px' }}
        >
          {t('cart:applyCoupon')}
        </button>
      </div>
      {promoApplied && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs text-green-600 font-medium"
        >
          {t('cart:couponApplied')} (−10%)
        </motion.p>
      )}

      {/* Price breakdown */}
      <motion.div layout className="mt-5 rounded-2xl bg-white shadow-sm p-4 space-y-2.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('cart:subtotal')}</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{t('cart:serviceFee')}</span>
          <span>{formatMoney(serviceFee, currency)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>{t('cart:deliveryFee')}</span>
          <span className="text-gray-400 text-xs italic">At checkout</span>
        </div>
        {discount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-between text-sm text-green-600"
          >
            <span>{t('cart:discount')}</span>
            <span>−{formatMoney(discount, currency)}</span>
          </motion.div>
        )}
        <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900">
          <span>{t('cart:total')}</span>
          <motion.span layout className="text-primary">
            {formatMoney(total, currency)}
          </motion.span>
        </div>
      </motion.div>

      {/* Sticky checkout button */}
      <div className="fixed bottom-[68px] left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3 z-40">
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.08 }}
          onClick={handleCheckout}
          className="w-full flex items-center justify-between bg-primary text-white rounded-2xl px-5 cursor-pointer hover:bg-primary/90 transition-colors"
          style={{ touchAction: 'manipulation', minHeight: '56px' }}
        >
          <span className="font-semibold">{t('cart:checkout')}</span>
          <div className="flex items-center gap-2">
            <span className="font-bold">{formatMoney(total, currency)}</span>
            <ChevronRight size={18} />
          </div>
        </motion.button>
      </div>
    </div>
  )
}
