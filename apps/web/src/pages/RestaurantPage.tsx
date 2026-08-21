import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Star, Clock, ShoppingBag } from 'lucide-react'

const GRADIENTS = [
  'from-orange-400 to-red-500',
  'from-violet-500 to-purple-600',
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-pink-400 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-sky-500',
  'from-lime-400 to-green-600',
]

function nameToGradient(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
import type { MenuItem, MenuCategory } from '@grandxl/types'
import { useRestaurant, useRestaurantMenu } from '../features/restaurants/hooks/useRestaurant'
import { MenuItemCard } from '../features/restaurants/components/MenuItemCard'
import { formatMoney } from '@grandxl/utils'

function HeroSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-52 bg-gray-200" />
      <div className="px-4 py-4 space-y-2">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  )
}

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('restaurants')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const { data: restaurantRes, isLoading: loadingRestaurant } = useRestaurant(id ?? '')
  const { data: menuRes, isLoading: loadingMenu } = useRestaurantMenu(id ?? '')

  const restaurant = restaurantRes
  const categories: MenuCategory[] = menuRes?.categories ?? []
  const items: MenuItem[] = menuRes?.items ?? []

  function scrollToCategory(categoryId: string) {
    setActiveCategory(categoryId)
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loadingRestaurant) return <HeroSkeleton />

  if (!restaurant) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-gray-400 text-sm">{t('common:error')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="relative">
        <div className="h-52 bg-gray-200 overflow-hidden">
          {restaurant.coverImage ? (
            <img
              src={restaurant.coverImage}
              alt={restaurant.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${nameToGradient(restaurant.name)}`}>
              <span className="font-display font-bold text-6xl text-white/80 drop-shadow select-none">
                {initials(restaurant.name)}
              </span>
            </div>
          )}
        </div>

        {/* Back button */}
        <button
          onClick={() => void navigate(-1)}
          className="absolute top-4 left-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm cursor-pointer hover:bg-white transition-colors"
          aria-label={t('common:back')}
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </button>

        {/* Closed badge */}
        {!restaurant.isOpen && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-gray-800 font-semibold px-4 py-2 rounded-full text-sm">
              {t('closed')}
            </span>
          </div>
        )}
      </div>

      {/* Restaurant info */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          {restaurant.logo && (
            <div className="shrink-0 w-14 h-14 rounded-xl border border-gray-100 overflow-hidden">
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-gray-900">{restaurant.name}</h1>
            {restaurant.cuisine.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">{restaurant.cuisine.join(' · ')}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
          {restaurant.ratingCount > 0 && (
            <span className="flex items-center gap-1.5">
              <Star size={14} className="text-secondary fill-secondary" />
              <span className="font-medium text-gray-800">{restaurant.rating.toFixed(1)}</span>
              <span className="text-gray-400">({restaurant.ratingCount})</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {t('estimatedTime', { minutes: restaurant.estimatedDeliveryTime })}
          </span>
          <span className="flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-gray-400" />
            {restaurant.deliveryFeeFixed === 0
              ? t('freeDelivery')
              : formatMoney(restaurant.deliveryFeeFixed, restaurant.currency)}
          </span>
        </div>

        {restaurant.minOrderAmount > 0 && (
          <p className="mt-1.5 text-xs text-gray-400">
            {t('minOrder')}: {formatMoney(restaurant.minOrderAmount, restaurant.currency)}
          </p>
        )}
      </div>

      {/* Category sticky tabs */}
      {categories.length > 1 && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-0 px-4">
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => scrollToCategory(cat._id)}
                className={`shrink-0 cursor-pointer px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 ${
                  activeCategory === cat._id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="px-4 pb-8">
        {loadingMenu ? (
          <div className="py-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
          </div>
        ) : categories.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t('common:noResults')}</p>
        ) : (
          categories.map((cat) => {
            const catItems = items.filter((item) => item.categoryId === cat._id)
            if (catItems.length === 0) return null
            return (
              <div
                key={cat._id}
                ref={(el) => { categoryRefs.current[cat._id] = el }}
                className="mt-6"
              >
                <h2 className="font-display font-bold text-gray-900 text-base mb-1">
                  {cat.name}
                </h2>
                {cat.description && (
                  <p className="text-xs text-gray-500 mb-2">{cat.description}</p>
                )}
                <div>
                  {catItems.map((item) => (
                    <MenuItemCard
                      key={item._id}
                      item={item}
                      restaurantId={restaurant._id}
                      currency={restaurant.currency}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
