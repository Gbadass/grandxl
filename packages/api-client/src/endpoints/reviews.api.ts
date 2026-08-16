import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Review } from '@grandxl/types'

export interface CreateReviewDto {
  orderId: string
  restaurantRating: number
  riderRating?: number
  foodRating?: number
  comment?: string
}

export const reviewsApi = {
  create: (dto: CreateReviewDto) =>
    getClient().post<ApiResponse<Review>>('/reviews', dto),

  getByRestaurant: (restaurantId: string, params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Review>>(`/restaurants/${restaurantId}/reviews`, {
      params,
    }),
}
