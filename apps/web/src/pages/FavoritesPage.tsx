import { useTranslation } from 'react-i18next'
import { Heart } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { restaurantsApi } from '@grandxl/api-client'
import { useFavorites } from '../hooks/useFavorites'
import { RestaurantCard } from '../features/restaurants/components/RestaurantCard'
import type { Restaurant } from '@grandxl/types'

function FavoriteSkeleton() {
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

export default function FavoritesPage() {
  const { t } = useTranslation('restaurants')
  const { favoriteIds } = useFavorites()

  const ids = [...favoriteIds]

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['restaurant', id],
      queryFn: async () => {
        const res = await restaurantsApi.getById(id)
        return res.data.data
      },
      staleTime: 60_000,
    })),
  })

  const isLoading = results.some((r) => r.isLoading)
  const restaurants: Restaurant[] = results
    .map((r) => r.data)
    .filter((r): r is Restaurant => r !== undefined)

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Heart size={18} className="text-red-500 fill-red-500" />
        <h1 className="text-lg font-bold text-gray-900">
          {t('saved', 'Saved Restaurants')}
        </h1>
        {!isLoading && restaurants.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            {restaurants.length} {restaurants.length === 1 ? t('restaurant', 'restaurant') : t('restaurants', 'restaurants')}
          </span>
        )}
      </div>

      {/* Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: ids.length || 3 }).map((_, i) => (
            <FavoriteSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && ids.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <Heart size={28} className="text-red-300" />
          </div>
          <div>
            <p className="font-semibold text-gray-700 text-sm">
              {t('noFavorites', 'No saved restaurants yet')}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              {t('noFavoritesHint', 'Tap the ♡ on any restaurant to save it here for quick access.')}
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      {!isLoading && restaurants.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {restaurants.map((r) => (
            <RestaurantCard key={r._id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  )
}
