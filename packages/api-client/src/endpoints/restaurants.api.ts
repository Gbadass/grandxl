import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Restaurant } from '@grandxl/types'

export interface QueryRestaurantsDto {
  lat?: number
  lng?: number
  radius?: number
  cuisine?: string
  page?: number
  limit?: number
}

export const restaurantsApi = {
  getAll: (params?: QueryRestaurantsDto) =>
    getClient().get<PaginatedResponse<Restaurant>>('/restaurants', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Restaurant>>(`/restaurants/${id}`),

  getNearby: (params: { lat: number; lng: number; radius?: number }) =>
    getClient().get<PaginatedResponse<Restaurant>>('/restaurants', { params }),

  search: (q: string, params?: { lat?: number; lng?: number }) =>
    getClient().get<ApiResponse<{ restaurants: Restaurant[] }>>('/search', {
      params: { q, ...params },
    }),
}
