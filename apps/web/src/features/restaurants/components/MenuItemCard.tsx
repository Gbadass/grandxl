import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MenuItem } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../../cart/store/cart.store'

interface Props {
  item: MenuItem
  restaurantId: string
  currency: string
}

const FOOD_GRADIENTS = [
  'from-amber-300 to-orange-400',
  'from-red-300 to-rose-500',
  'from-green-300 to-emerald-500',
  'from-yellow-300 to-amber-500',
  'from-orange-300 to-red-400',
  'from-lime-300 to-green-400',
]

function nameToGradient(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return FOOD_GRADIENTS[hash % FOOD_GRADIENTS.length]
}

export function MenuItemCard({ item, restaurantId, currency }: Props) {
  const { t } = useTranslation('menu')
  const [added, setAdded] = useState(false)
  const { addItem, wouldClearCart } = useCartStore()

  if (!item.isAvailable) return null

  function handleAdd() {
    if (added) return

    if (wouldClearCart(restaurantId)) {
      const confirmed = window.confirm(
        'Your cart has items from another restaurant. Starting a new order will clear it. Continue?',
      )
      if (!confirmed) return
    }

    addItem({
      menuItemId: item._id,
      restaurantId,
      name: item.name,
      image: item.image,
      basePrice: item.basePrice,
      quantity: 1,
      selectedVariants: [],
      selectedAddOns: [],
      itemTotal: item.basePrice,
      note: null,
    })
    toast.success(t('itemAdded'), { duration: 1200 })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="flex gap-3 py-4 border-b border-gray-50 last:border-0">
      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h4 className="text-sm font-semibold text-gray-900 leading-snug">{item.name}</h4>
          {item.isPopular && (
            <span className="shrink-0 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mt-0.5">
              {t('popular')}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.description}</p>
        )}

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">
            {formatMoney(item.basePrice, currency)}
          </span>

          <motion.button
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.07 }}
            onClick={handleAdd}
            disabled={added}
            aria-label={t('addToCart')}
            className={`flex items-center justify-center w-9 h-9 rounded-full shadow-sm transition-colors duration-200 cursor-pointer ${
              added ? 'bg-green-500 disabled:opacity-100' : 'bg-primary hover:bg-primary/90'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            {added ? <Check size={16} strokeWidth={2.5} className="text-white" /> : <Plus size={16} strokeWidth={2.5} className="text-white" />}
          </motion.button>
        </div>
      </div>

      {/* Image — show gradient placeholder when no photo */}
      <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${nameToGradient(item.name)} flex items-center justify-center`}>
            <span className="text-white/80 text-xl font-bold select-none">
              {item.name[0]?.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
