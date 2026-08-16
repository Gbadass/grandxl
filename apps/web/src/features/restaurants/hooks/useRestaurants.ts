import { useQuery } from '@tanstack/react-query'
import { restaurantsApi, foodCategoriesApi, type QueryRestaurantsDto } from '@grandxl/api-client'

// restaurantsApi.getAll() → AxiosResponse<PaginatedResponse<Restaurant>>
// PaginatedResponse.data = { data: Restaurant[], meta: PaginatedMeta }
export function useRestaurants(params?: QueryRestaurantsDto) {
  return useQuery({
    queryKey: ['restaurants', params],
    queryFn: () => restaurantsApi.getAll(params).then((r) => r.data.data),
    staleTime: 1000 * 60 * 2,
  })
}

export function useNearbyRestaurants(coords: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: ['restaurants', 'nearby', coords],
    queryFn: () =>
      restaurantsApi.getNearby({ lat: coords!.lat, lng: coords!.lng }).then((r) => r.data.data),
    enabled: coords !== null,
    staleTime: 1000 * 60 * 2,
  })
}

// foodCategoriesApi.getAll() → AxiosResponse<ApiResponse<FoodCategory[]>>
// ApiResponse.data = FoodCategory[]
export function useFoodCategories() {
  return useQuery({
    queryKey: ['food-categories'],
    queryFn: () => foodCategoriesApi.getAll().then((r) => r.data.data),
    staleTime: 1000 * 60 * 10,
  })
}
