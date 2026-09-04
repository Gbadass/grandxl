import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, type Variants } from 'framer-motion'
import {
  Search, MapPin, ChevronDown, ChevronRight, Star,
  Wheat, Flame, Beef, Coffee, Fish, Leaf, UtensilsCrossed,
  Pizza, Soup, Apple, Grid2X2, Sandwich, Drumstick, GlassWater,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Restaurant as RestaurantType } from '@grandxl/types'
import { useRestaurants, useFoodCategories } from '../features/restaurants/hooks/useRestaurants'
import { RestaurantCard } from '../features/restaurants/components/RestaurantCard'
import { RestaurantCardHorizontal } from '../features/restaurants/components/RestaurantCardHorizontal'
import { LocationPickerSheet } from '../components/organisms/LocationPickerSheet'
import { PwaInstallCard } from '../components/molecules/PwaInstallCard'
import { useLocationStore } from '../store/location.store'
import { ROUTES } from '../router/routes'

// ── Greeting ──────────────────────────────────────────────────────────────────

function greetingKey(): string {
  const h = new Date().getHours()
  if (h < 12) return 'good_morning'
  if (h < 17) return 'good_afternoon'
  return 'good_evening'
}

// ── Promo banners ─────────────────────────────────────────────────────────────

const PROMOS = [
  { id: 'free-delivery', titleKey: 'promo_free_title', subtitleKey: 'promo_free_sub', accent: 'from-primary to-rose-600',        badge: 'NEW'  },
  { id: 'fast-food',     titleKey: 'promo_fast_title', subtitleKey: 'promo_fast_sub', accent: 'from-amber-500 to-orange-600',   badge: 'FAST' },
  { id: 'top-rated',     titleKey: 'promo_top_title',  subtitleKey: 'promo_top_sub',  accent: 'from-violet-500 to-purple-700',  badge: 'TOP'  },
]

// ── Category icon map ─────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  rice: Wheat,
  chicken: Drumstick,
  poultry: Drumstick,
  burgers: Beef,
  burger: Beef,
  pizza: Pizza,
  coffee: Coffee,
  drinks: GlassWater,
  beverages: GlassWater,
  fish: Fish,
  seafood: Fish,
  salad: Leaf,
  vegetarian: Apple,
  vegan: Apple,
  african: UtensilsCrossed,
  nigerian: UtensilsCrossed,
  swallow: Wheat,
  fufu: Wheat,
  pasta: UtensilsCrossed,
  grill: Flame,
  bbq: Flame,
  'soups-stews': Soup,
  'soups & stews': Soup,
  soups: Soup,
  stews: Soup,
  soup: Soup,
  sandwich: Sandwich,
  wrap: Sandwich,
  snacks: Sandwich,
}

const CATEGORY_COLORS: Record<string, string> = {
  rice: 'bg-amber-100 text-amber-700',
  chicken: 'bg-red-100 text-red-600',
  poultry: 'bg-red-100 text-red-600',
  burgers: 'bg-orange-100 text-orange-700',
  burger: 'bg-orange-100 text-orange-700',
  pizza: 'bg-rose-100 text-rose-600',
  coffee: 'bg-yellow-100 text-yellow-700',
  drinks: 'bg-blue-100 text-blue-600',
  beverages: 'bg-blue-100 text-blue-600',
  fish: 'bg-cyan-100 text-cyan-700',
  seafood: 'bg-cyan-100 text-cyan-700',
  salad: 'bg-green-100 text-green-700',
  vegetarian: 'bg-lime-100 text-lime-700',
  african: 'bg-primary/10 text-primary',
  nigerian: 'bg-primary/10 text-primary',
  swallow: 'bg-amber-100 text-amber-700',
  fufu: 'bg-amber-100 text-amber-700',
  grill: 'bg-red-100 text-red-600',
  bbq: 'bg-red-100 text-red-600',
  'soups-stews': 'bg-teal-100 text-teal-700',
  'soups & stews': 'bg-teal-100 text-teal-700',
  soups: 'bg-teal-100 text-teal-700',
  stews: 'bg-teal-100 text-teal-700',
  soup: 'bg-teal-100 text-teal-700',
  snacks: 'bg-purple-100 text-purple-700',
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RestaurantSkeleton() {
  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-sm animate-pulse">
      <div className="h-40 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  )
}

function HorizontalSkeleton() {
  return (
    <div className="shrink-0 w-56 rounded-2xl bg-white overflow-hidden shadow-sm animate-pulse">
      <div className="h-36 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

// ── Category chip ─────────────────────────────────────────────────────────────

function CategoryChip({
  label,
  slug,
  active,
  onClick,
}: {
  label: string
  slug: string | null
  active: boolean
  onClick: () => void
}) {
  // Try slug as-is, then normalised (spaces/& → hyphen) to handle API slug formats
  function lookup<T>(map: Record<string, T>, key: string): T | undefined {
    const k = key.toLowerCase()
    return map[k] ?? map[k.replace(/[\s&]+/g, '-')] ?? map[k.replace(/[\s&-]+/g, '')]
  }
  const Icon = slug ? (lookup(CATEGORY_ICONS, slug) ?? UtensilsCrossed) : Grid2X2
  const colorClass = slug
    ? (lookup(CATEGORY_COLORS, slug) ?? 'bg-gray-100 text-gray-600')
    : 'bg-gray-100 text-gray-600'

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      style={{ touchAction: 'manipulation' }}
      className={`shrink-0 flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-150 ${
        active ? 'opacity-100' : 'opacity-70 hover:opacity-100'
      }`}
    >
      <div
        className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-150 ${
          active ? 'bg-primary shadow-md shadow-primary/30 scale-110' : colorClass
        }`}
      >
        <Icon size={20} className={active ? 'text-white' : ''} />
      </div>
      <span
        className={`text-[10px] font-semibold tracking-tight whitespace-nowrap ${
          active ? 'text-primary' : 'text-gray-500'
        }`}
      >
        {label}
      </span>
    </motion.button>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string
  onSeeAll?: () => void
}) {
  const { t } = useTranslation('restaurants')
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display font-bold text-gray-900 text-[17px]">{title}</h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-xs font-semibold text-primary cursor-pointer"
          style={{ touchAction: 'manipulation' }}
        >
          {t('see_all')} <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.22, ease: 'easeOut' },
  }),
}

export default function HomePage() {
  const { t } = useTranslation(['restaurants', 'common'])
  const navigate = useNavigate()
  const city = useLocationStore((s) => s.city)
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const featuredRef = useRef<HTMLDivElement>(null)

  const { data: categories = [] } = useFoodCategories()
  const { data: restaurantPage, isLoading } = useRestaurants(
    activeCuisine ? { cuisine: activeCuisine } : undefined,
  )
  const restaurants: RestaurantType[] = restaurantPage?.data ?? []

  // Featured = top-rated open restaurants (client-side slice, no extra API call)
  const featured = restaurants
    .filter((r) => r.isOpen && r.ratingCount > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6)

  return (
    <div className="max-w-2xl mx-auto pb-28 overflow-x-hidden">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 pt-4 pb-3 space-y-3">
        {/* Greeting + delivery location */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-gray-400 leading-none">{t(greetingKey())}</p>
            <button
              type="button"
              onClick={() => setLocationSheetOpen(true)}
              className="flex items-center gap-1 cursor-pointer group mt-0.5"
              aria-label={t('changeDeliveryLocation')}
            >
              <MapPin size={13} className="text-primary shrink-0" />
              <span className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors duration-150 leading-tight">
                {city ?? t('common:nav.location')}
              </span>
              <ChevronDown size={13} className="text-gray-400" />
            </button>
          </div>

          {/* Live dot indicator */}
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-full px-2.5 py-1.5">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-green-500"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] font-semibold text-green-700">{t('delivering')}</span>
          </div>
        </div>

        {/* Search bar */}
        <button
          type="button"
          onClick={() => void navigate(ROUTES.SEARCH)}
          className="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 cursor-pointer hover:bg-gray-200/80 transition-colors duration-150 min-h-[44px]"
          style={{ touchAction: 'manipulation' }}
        >
          <Search size={16} className="text-gray-400 shrink-0" />
          <span className="text-gray-400 text-sm font-medium">{t('search')}</span>
        </button>
      </div>

      {/* S14-13: PWA install nudge — auto-shows on installable browsers, respects
          a 7-day dismissal cooldown. Renders nothing on iOS Safari (which
          doesn't fire beforeinstallprompt). */}
      <PwaInstallCard />

      {/* ── Promo banners ─────────────────────────────────────────── */}
      <motion.div
        custom={0} variants={fadeUp} initial="hidden" animate="visible"
        className="px-4 pt-4"
      >
        <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
          {PROMOS.map((promo) => (
            <motion.div
              key={promo.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => void navigate(ROUTES.RESTAURANTS)}
              className={`shrink-0 snap-start w-[72vw] max-w-[280px] rounded-3xl bg-gradient-to-br ${promo.accent} p-5 cursor-pointer overflow-hidden relative`}
              style={{ touchAction: 'manipulation' }}
            >
              {/* Background decoration */}
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -right-2 -bottom-6 h-16 w-16 rounded-full bg-white/10" />

              <div className="inline-flex items-center gap-1 text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full mb-2">
                {promo.id === 'top-rated' && <Star size={9} className="fill-white text-white" />}
                {promo.badge}
              </div>
              <p className="font-display font-bold text-white text-[18px] leading-tight">{t(promo.titleKey)}</p>
              <p className="text-white/75 text-xs mt-1 font-medium">{t(promo.subtitleKey)}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Categories ────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <motion.div
          custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="px-4 pt-5"
        >
          <SectionHeader title={t('craving')} />
          <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            <CategoryChip
              label={t('all_categories')}
              slug={null}
              active={activeCuisine === null}
              onClick={() => setActiveCuisine(null)}
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat.slug}
                label={cat.name}
                slug={cat.slug}
                active={activeCuisine === cat.slug}
                onClick={() => setActiveCuisine(cat.slug === activeCuisine ? null : cat.slug)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Featured restaurants (horizontal scroll) ──────────────── */}
      {!activeCuisine && (
        <motion.div
          custom={2} variants={fadeUp} initial="hidden" animate="visible"
          className="pt-5"
        >
          <div className="px-4">
            <SectionHeader
              title={t('top_rated_near')}
              onSeeAll={() => void navigate(ROUTES.RESTAURANTS)}
            />
          </div>
          <div
            ref={featuredRef}
            className="flex gap-3 overflow-x-auto px-4 pb-2 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          >
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <HorizontalSkeleton key={i} />)
              : featured.map((r) => (
                  <div key={r._id} className="snap-start shrink-0">
                    <RestaurantCardHorizontal restaurant={r} />
                  </div>
                ))}
          </div>
        </motion.div>
      )}

      {/* ── All / filtered restaurants ────────────────────────────── */}
      <motion.div
        custom={3} variants={fadeUp} initial="hidden" animate="visible"
        className="px-4 pt-5"
      >
        <SectionHeader
          title={activeCuisine ? t('all') : t('nearby')}
          onSeeAll={!activeCuisine ? () => void navigate(ROUTES.RESTAURANTS) : undefined}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <RestaurantSkeleton key={i} />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <UtensilsCrossed size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700 text-sm">{t('common:noResults')}</p>
            <p className="text-gray-400 text-xs mt-1">{t('try_different')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {restaurants.map((r, i) => (
              <motion.div
                key={r._id}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
              >
                <RestaurantCard restaurant={r} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <LocationPickerSheet
        isOpen={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />
    </div>
  )
}
