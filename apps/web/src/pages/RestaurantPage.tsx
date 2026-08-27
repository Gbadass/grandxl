import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star, Clock, ShoppingBag, X } from 'lucide-react'

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
import { formatMoney, findSpecialHoursForDay } from '@grandxl/utils'

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

// Sprint 12 (S12-8): sentinel used for the synthetic "Featured" section — never
// collides with a real MongoDB category id, so the sticky-tab handler can treat
// it the same as any real category id.
const FEATURED_SECTION_ID = '__featured'

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t }        = useTranslation('restaurants')
  const { t: tMenu } = useTranslation('menu')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Sprint 12 (S12-9): lightbox state — index into restaurant.gallery, or null when closed
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const { data: restaurantRes, isLoading: loadingRestaurant } = useRestaurant(id ?? '')
  const { data: menuRes, isLoading: loadingMenu } = useRestaurantMenu(id ?? '')

  const restaurant = restaurantRes
  const categories: MenuCategory[] = menuRes?.categories ?? []
  const items: MenuItem[] = menuRes?.items ?? []
  const featured: MenuItem[] = items.filter((i) => i.isPopular)
  const gallery: string[]      = restaurant?.gallery ?? []
  // Sprint 12 (S12-10): today's date-specific override — null when the weekly
  // schedule applies. Rendered as a banner above the menu so customers see it
  // before they start browsing.
  const todaySpecial = findSpecialHoursForDay(
    restaurant?.specialHours,
    (restaurant as unknown as { timezone?: string } | undefined)?.timezone ?? 'Africa/Lagos',
  )

  function scrollToCategory(categoryId: string) {
    setActiveCategory(categoryId)
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Sprint 12 (S12-9): lightbox keyboard shortcuts. Left/right cycle, Esc closes.
  // Wraps around end-to-start so the customer can browse without knowing the count.
  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     setLightboxIndex(null)
      if (e.key === 'ArrowLeft')  setLightboxIndex((i) => (i === null ? null : (i - 1 + gallery.length) % gallery.length))
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : (i + 1) % gallery.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, gallery.length])

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

      {/* Sprint 12 (S12-10): today's special-hours override banner */}
      {todaySpecial && (
        <div
          className={`border-b px-4 py-2.5 text-sm ${
            todaySpecial.isClosed
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            <Clock size={15} className="mt-0.5 shrink-0" />
            <p className="flex-1">
              {todaySpecial.isClosed ? (
                <>
                  <span className="font-semibold">Closed today.</span>
                  {todaySpecial.note ? ` ${todaySpecial.note}` : ''}
                </>
              ) : (
                <>
                  <span className="font-semibold">Special hours today:</span>{' '}
                  <span className="tabular-nums">{todaySpecial.open} – {todaySpecial.close}</span>
                  {todaySpecial.note ? ` · ${todaySpecial.note}` : ''}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Sprint 12 (S12-9): photo gallery strip (only when owner has added photos) */}
      {gallery.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {gallery.map((url, i) => (
              <button
                key={`${url}-${i}`}
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open photo ${i + 1} of ${gallery.length}`}
                className="shrink-0 h-24 w-32 overflow-hidden rounded-xl bg-gray-100 cursor-pointer transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/60"
              >
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category sticky tabs */}
      {(categories.length > 1 || featured.length > 0) && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-0 px-4">
            {/* Sprint 12 (S12-8): Featured tab appears first when the restaurant
                has any featured items. Uses the sentinel id so scrollToCategory
                treats it identically to a real category. */}
            {featured.length > 0 && (
              <button
                key={FEATURED_SECTION_ID}
                onClick={() => scrollToCategory(FEATURED_SECTION_ID)}
                className={`shrink-0 cursor-pointer px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150 inline-flex items-center gap-1.5 ${
                  activeCategory === FEATURED_SECTION_ID
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Star size={13} fill="currentColor" strokeWidth={0} className="text-amber-500" />
                {tMenu('featured')}
              </button>
            )}
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
          <>
            {/* Sprint 12 (S12-8): Featured section — items curated by the
                restaurant owner via the "Feature" toggle. Rendered above the
                category loop so they get top-of-menu visibility. */}
            {featured.length > 0 && (
              <div
                key={FEATURED_SECTION_ID}
                ref={(el) => { categoryRefs.current[FEATURED_SECTION_ID] = el }}
                className="mt-6"
              >
                <h2 className="font-display font-bold text-gray-900 text-base mb-1 flex items-center gap-2">
                  <Star size={16} fill="currentColor" strokeWidth={0} className="text-amber-500" />
                  {tMenu('featured')}
                </h2>
                <div>
                  {featured.map((item) => (
                    <MenuItemCard
                      key={`featured-${item._id}`}
                      item={item}
                      restaurantId={restaurant._id}
                      currency={restaurant.currency}
                    />
                  ))}
                </div>
              </div>
            )}
            {categories.map((cat) => {
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
          })}
          </>
        )}
      </div>

      {/* Sprint 12 (S12-9): fullscreen lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && gallery[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLightboxIndex(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLightboxIndex(null)
              }}
              aria-label={t('common:close', { defaultValue: 'Close' })}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <X size={20} />
            </button>
            {gallery.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxIndex((i) => (i === null ? null : (i - 1 + gallery.length) % gallery.length))
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 sm:left-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxIndex((i) => (i === null ? null : (i + 1) % gallery.length))
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 sm:right-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1   }}
              exit={{    opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              src={gallery[lightboxIndex]}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white tabular-nums">
              {lightboxIndex + 1} / {gallery.length}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
