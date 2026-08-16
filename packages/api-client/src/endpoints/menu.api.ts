import { getClient } from '../client'
import type { ApiResponse, MenuItem, MenuCategory } from '@grandxl/types'

export const menuApi = {
  getCategories: (restaurantId: string) =>
    getClient().get<ApiResponse<MenuCategory[]>>(`/restaurants/${restaurantId}/categories`),

  getItems: (restaurantId: string) =>
    getClient().get<ApiResponse<{ categories: MenuCategory[]; items: MenuItem[] }>>(`/restaurants/${restaurantId}/menu`),

  getItemById: (_restaurantId: string, itemId: string) =>
    getClient().get<ApiResponse<MenuItem>>(`/menu-items/${itemId}`),
}
