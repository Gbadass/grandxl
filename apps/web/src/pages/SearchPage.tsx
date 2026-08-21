import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowLeft, UtensilsCrossed, Store, X } from 'lucide-react'
import { searchApi } from '@grandxl/api-client'
import type { Restaurant, MenuItem } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { RestaurantCard } from '../features/restaurants/components/RestaurantCard'
import { ROUTES } from '../router/routes'

// ── Skeletons ─────────────────────────────────────────────────────────────────

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

function MenuItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 animate-pulse">
      <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/5" />
        <div className="h-3 bg-gray-100 rounded w-2/5" />
        <div className="h-3 bg-gray-100 rounded w-1/4" />
      </div>
    </div>
  )
}

// ── Menu item row ─────────────────────────────────────────────────────────────

function MenuItemRow({ item }: { item: MenuItem }) {
  const { t } = useTranslation('search')

  return (
    <Link
      to={ROUTES.RESTAURANT(item.restaurantId)}
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UtensilsCrossed size={20} className="text-gray-300" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
        )}
        <p className="text-sm font-bold text-primary mt-1">
          {formatMoney(item.basePrice, 'NGN')}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {!item.isAvailable && (
          <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
            {t('unavailable')}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors duration-150 cursor-pointer whitespace-nowrap ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  const { t } = useTranslation('search')

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Search size={28} className="text-gray-300" />
      </div>
      <p className="font-semibold text-gray-700 mb-1">
        {t('noResults', { query })}
      </p>
      <p className="text-sm text-gray-400">
        {t('tryDifferent')}
      </p>
    </div>
  )
}

// ── Prompt state (no query yet) ───────────────────────────────────────────────

function SearchPrompt() {
  const { t } = useTranslation('search')

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Search size={28} className="text-primary" />
      </div>
      <p className="font-semibold text-gray-700 mb-1">
        {t('prompt')}
      </p>
      <p className="text-sm text-gray-400">
        {t('promptSub')}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabId = 'restaurants' | 'dishes'

export default function SearchPage() {
  const { t } = useTranslation('search')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)
  const [activeTab, setActiveTab] = useState<TabId>('restaurants')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce input → debouncedQ → URL param
  const handleInput = useCallback((value: string) => {
    setInputValue(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQ(value)
      setSearchParams(value.trim() ? { q: value.trim() } : {}, { replace: true })
    }, 400)
  }, [setSearchParams])

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => searchApi.search({ q: debouncedQ }),
    enabled: debouncedQ.trim().length >= 2,
    staleTime: 30_000,
  })

  const results = data?.data?.data
  const restaurants: Restaurant[] = results?.restaurants ?? []
  const menuItems: MenuItem[] = results?.menuItems ?? []
  const hasQuery = debouncedQ.trim().length >= 2
  const loading = isLoading || isFetching
  const hasResults = restaurants.length > 0 || menuItems.length > 0

  // Switch to dishes tab automatically if no restaurants but has dishes
  useEffect(() => {
    if (hasQuery && !loading && restaurants.length === 0 && menuItems.length > 0) {
      setActiveTab('dishes')
    }
  }, [hasQuery, loading, restaurants.length, menuItems.length])

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* ── Search header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 pt-3 pb-0">
        <div className="flex items-center gap-3 mb-3">
          {/* Back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-150 cursor-pointer"
            aria-label={tc('back')}
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>

          {/* Input */}
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5 min-h-[44px]">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={inputValue}
              onChange={(e) => handleInput(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
              autoComplete="off"
              autoCorrect="off"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => { setInputValue(''); setDebouncedQ(''); setSearchParams({}, { replace: true }) }}
                className="shrink-0 cursor-pointer"
                aria-label={tc('clear')}
              >
                <X size={15} className="text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs — only when there's a query */}
        {hasQuery && !loading && hasResults && (
          <div className="flex border-b border-transparent -mb-px overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <Tab
              label={t('tabRestaurants')}
              count={results?.meta.restaurantCount ?? 0}
              active={activeTab === 'restaurants'}
              onClick={() => setActiveTab('restaurants')}
            />
            <Tab
              label={t('tabDishes')}
              count={results?.meta.menuItemCount ?? 0}
              active={activeTab === 'dishes'}
              onClick={() => setActiveTab('dishes')}
            />
          </div>
        )}
      </div>

      {/* ── Results area ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!hasQuery ? (
          <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SearchPrompt />
          </motion.div>
        ) : loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {activeTab === 'restaurants' ? (
              <div className="grid grid-cols-2 gap-3 px-4 pt-4">
                {Array.from({ length: 4 }).map((_, i) => <RestaurantSkeleton key={i} />)}
              </div>
            ) : (
              <div className="pt-2">
                {Array.from({ length: 5 }).map((_, i) => <MenuItemSkeleton key={i} />)}
              </div>
            )}
          </motion.div>
        ) : !hasResults ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState query={debouncedQ} />
          </motion.div>
        ) : activeTab === 'restaurants' ? (
          <motion.div
            key="restaurants"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {restaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                <Store size={32} className="text-gray-300" />
                <p className="text-sm text-gray-500">
                  {t('noRestaurants', { query: debouncedQ })}
                </p>
                {menuItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dishes')}
                    className="text-sm text-primary font-semibold mt-1 cursor-pointer hover:underline"
                  >
                    {t('seeDishes', { count: menuItems.length })}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-4 pt-4">
                {restaurants.map((r) => (
                  <RestaurantCard key={r._id} restaurant={r} />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="dishes"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {menuItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6">
                <UtensilsCrossed size={32} className="text-gray-300" />
                <p className="text-sm text-gray-500">
                  {t('noDishes', { query: debouncedQ })}
                </p>
                {restaurants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('restaurants')}
                    className="text-sm text-primary font-semibold mt-1 cursor-pointer hover:underline"
                  >
                    {t('seeRestaurants', { count: restaurants.length })}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 bg-white">
                {menuItems.map((item) => (
                  <MenuItemRow key={item._id} item={item} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
