import { getClient } from '../client'
import type { ApiResponse, FoodCategory, CreateFoodCategoryDto, UpdateFoodCategoryDto } from '@grandxl/types'

export const foodCategoriesApi = {
  getAll: () =>
    getClient().get<ApiResponse<FoodCategory[]>>('/food-categories'),

  create: (dto: CreateFoodCategoryDto) =>
    getClient().post<ApiResponse<FoodCategory>>('/food-categories', dto),

  update: (id: string, dto: UpdateFoodCategoryDto) =>
    getClient().patch<ApiResponse<FoodCategory>>(`/food-categories/${id}`, dto),

  remove: (id: string) =>
    getClient().delete<void>(`/food-categories/${id}`),
}
