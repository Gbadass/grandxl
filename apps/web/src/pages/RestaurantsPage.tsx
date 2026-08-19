import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { Restaurant } from '@grandxl/types'
import { useRestaurants, useFoodCategories } from '../features/restaurants/hooks/useRestaurants'
import { RestaurantCard } from '../features/restaurants/components/RestaurantCard'
import { restaurantsApi } from '@grandxl/api-client'
import { useQuery } from '@tanstack/react-query'
import { useLocationStore } from '../store/location.store'

type SortKey = 'rating' | 'deliveryTime' | 'default'

function RestaurantSkeleton() {
  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-sm animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  const { t } = useTranslation('restaurants')
  const [query, setQuery] = useState('')
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('default')

  const coordinates = useLocationStore((s) => s.coordinates)

  const { data: categories = [] } = useFoodCategories()
  const { data: restaurantPage, isLoading } = useRestaurants(
    activeCuisine ? { cuisine: activeCuisine } : undefined,
  )
  const allRestaurants: Restaurant[] = restaurantPage?.data ?? []

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['restaurant-search', query],
    queryFn: () =>
      restaurantsApi
        .search(query, coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : undefined)
        .then((r) => r.data.data.restaurants),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  })

  const filtered = useCallback(() => {
    // When actively searching, server handles text matching — skip client-side text filter
    let list = allRestaurants
    if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating)
    if (sort === 'deliveryTime')
      list = [...list].sort((a, b) => a.estimatedDeliveryTime - b.estimatedDeliveryTime)
    return list
  }, [allRestaurants, sort])

  const isSearching = query.trim().length >= 2
  const restaurants: Restaurant[] = isSearching ? (searchResults ?? []) : filtered()
  const showLoading = isSearching ? isLoading || searchLoading : isLoading

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search')}
          className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/30 transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Cuisine chips + sort */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setActiveCuisine(null)}
          className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            activeCuisine === null
              ? 'bg-primary text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
          }`}
        >
          {t('all', 'All')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCuisine(cat.slug === activeCuisine ? null : cat.slug)}
            className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCuisine === cat.slug
                ? 'bg-primary text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
            }`}
          >
            {cat.name}
          </button>
        ))}

        {/* Sort */}
        <div className="ml-auto shrink-0 flex items-center gap-1.5">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs text-gray-600 bg-transparent outline-none cursor-pointer"
          >
            <option value="default">{t('filters.rating', 'Recommended')}</option>
            <option value="rating">{t('filters.rating')}</option>
            <option value="deliveryTime">{t('filters.deliveryTime')}</option>
          </select>
        </div>
      </div>

      {/* Count */}
      {!showLoading && (
        <p className="text-xs text-gray-500 mb-4">
          {restaurants.length} {t('all', 'restaurants')}
        </p>
      )}

      {/* Grid */}
      {showLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <RestaurantSkeleton key={i} />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-400">{t('common:noResults')}</p>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="mt-3 text-sm text-primary cursor-pointer hover:underline"
            >
              {t('common:retry')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {restaurants.map((r) => (
            <RestaurantCard key={r._id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  )
}
