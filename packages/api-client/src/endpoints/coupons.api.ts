import { getClient } from '../client'
import type { ApiResponse, Coupon, CouponValidationResult } from '@grandxl/types'

export interface ValidateCouponDto {
  code: string
  restaurantId: string
  subtotalKobo: number
}

export interface CreateRestaurantCouponDto {
  code: string
  type: 'percentage' | 'fixed_amount' | 'free_delivery'
  value: number
  minOrderAmount?: number
  maxDiscount?: number
  usageLimit?: number
  perUserLimit?: number
  startDate: string
  endDate: string
}

export const couponsApi = {
  validate: (dto: ValidateCouponDto) =>
    getClient().post<ApiResponse<CouponValidationResult>>('/coupons/validate', dto),
}

// Restaurant-owner-scoped coupon management — applies only to the caller's restaurant.
export const restaurantCouponsApi = {
  create: (dto: CreateRestaurantCouponDto) =>
    getClient().post<ApiResponse<Coupon>>('/restaurant/coupons', dto),

  list: () =>
    getClient().get<ApiResponse<Coupon[]>>('/restaurant/coupons'),

  deactivate: (id: string) =>
    getClient().delete<ApiResponse<Coupon>>(`/restaurant/coupons/${id}`),
}
