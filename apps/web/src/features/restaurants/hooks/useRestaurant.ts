import { useQuery } from '@tanstack/react-query'
import { restaurantsApi, menuApi } from '@grandxl/api-client'

// restaurantsApi.getById() → AxiosResponse<ApiResponse<Restaurant>>
// ApiResponse.data = Restaurant
export function useRestaurant(id: string) {
  return useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => restaurantsApi.getById(id).then((r) => r.data.data),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  })
}

// menuApi.getItems() → AxiosResponse<ApiResponse<{ categories, items }>>
// ApiResponse.data = { categories: MenuCategory[], items: MenuItem[] }
export function useRestaurantMenu(restaurantId: string) {
  return useQuery({
    queryKey: ['restaurant-menu', restaurantId],
    queryFn: () => menuApi.getItems(restaurantId).then((r) => r.data.data),
    enabled: Boolean(restaurantId),
    staleTime: 1000 * 60 * 5,
  })
}
