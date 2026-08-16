import { getClient } from '../client'
import type {
  ApiResponse,
  PaginatedResponse,
  Restaurant,
  Rider,
  Order,
  Review,
  User,
  PlatformConfig,
  Coupon,
  BankDetails,
} from '@grandxl/types'
import type { RestaurantApprovalStatus, OrderStatus } from '@grandxl/types'

// ── Admin — Restaurants ──────────────────────────────────────────────────────

export interface AdminRestaurantQueryDto {
  status?: RestaurantApprovalStatus
  page?: number
  limit?: number
}

export interface RejectRestaurantDto {
  reason: string
}

export interface SuspendRestaurantDto {
  reason: string
}

export interface RequestMoreInfoDto {
  message: string
}

export const adminRestaurantsApi = {
  list: (params?: AdminRestaurantQueryDto) =>
    getClient().get<PaginatedResponse<Restaurant>>('/admin/restaurants', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Restaurant>>(`/admin/restaurants/${id}`),

  approve: (id: string) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/approve`),

  reject: (id: string, dto: RejectRestaurantDto) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/reject`, dto),

  requestInfo: (id: string, dto: RequestMoreInfoDto) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/request-info`, dto),

  suspend: (id: string, dto: SuspendRestaurantDto) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/suspend`, dto),

  reinstate: (id: string) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/reinstate`),
}

// ── Admin — Riders ───────────────────────────────────────────────────────────

export const adminRidersApi = {
  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Rider>>('/admin/riders', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Rider>>(`/admin/riders/${id}`),

  verify: (id: string) =>
    getClient().post<ApiResponse<Rider>>(`/admin/riders/${id}/verify`),

  assignToOrder: (riderId: string, orderId: string) =>
    getClient().post<ApiResponse<{ assigned: boolean }>>(
      `/admin/riders/${riderId}/assign/${orderId}`,
    ),
}

// ── Admin — Orders ───────────────────────────────────────────────────────────

export interface AdminOrderQueryDto {
  status?: OrderStatus
  page?: number
  limit?: number
}

export const adminOrdersApi = {
  list: (params?: AdminOrderQueryDto) =>
    getClient().get<PaginatedResponse<Order>>('/admin/orders', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Order>>(`/admin/orders/${id}`),

  clearAll: () =>
    getClient().delete<ApiResponse<{ cleared: number }>>('/admin/orders/all'),
}

// ── Admin — Reviews ──────────────────────────────────────────────────────────

export interface SetVisibilityDto {
  isVisible: boolean
}

export const adminReviewsApi = {
  getFlagged: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Review>>('/admin/reviews/flagged', { params }),

  setVisibility: (id: string, dto: SetVisibilityDto) =>
    getClient().patch<ApiResponse<Review>>(`/admin/reviews/${id}/visibility`, dto),
}

// ── Platform Config ──────────────────────────────────────────────────────────

export interface UpdatePlatformConfigDto {
  platformCommissionPercent?: number
  minRiderEarningKobo?: number
  enabledServices?: {
    instamart?: boolean
    dineout?: boolean
    drinks?: boolean
  }
}

export interface CreateCouponDto {
  code: string
  type: 'percentage' | 'fixed_amount' | 'free_delivery'
  value: number
  minOrderAmount: number
  maxDiscount: number
  usageLimit: number
  perUserLimit: number
  startDate: string
  endDate: string
}

export const platformConfigApi = {
  get: () =>
    getClient().get<ApiResponse<PlatformConfig>>('/platform/config'),

  update: (dto: UpdatePlatformConfigDto) =>
    getClient().patch<ApiResponse<PlatformConfig>>('/platform/config', dto),

  listCoupons: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Coupon>>('/platform/coupons', { params }),

  createCoupon: (dto: CreateCouponDto) =>
    getClient().post<ApiResponse<Coupon>>('/platform/coupons', dto),

  deactivateCoupon: (id: string) =>
    getClient().delete<ApiResponse<null>>(`/platform/coupons/${id}`),
}

// ── Admin — Users ────────────────────────────────────────────────────────────

export const adminUsersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    getClient().get<PaginatedResponse<User>>('/admin/users', { params }),

  ban: (id: string) =>
    getClient().patch<ApiResponse<{ banned: boolean }>>(`/admin/users/${id}/ban`),

  unban: (id: string) =>
    getClient().patch<ApiResponse<{ banned: boolean }>>(`/admin/users/${id}/unban`),
}

// ── Restaurant Owner — own restaurant & orders ───────────────────────────────

export interface CreateRestaurantDto {
  name: string
  description?: string
  phone: string
  email?: string
  cuisine: string[]
  address: {
    street: string
    city: string
    state: string
    country?: string
    coordinates: { lat: number; lng: number }
  }
  deliveryRadius?: number
  minOrderAmount?: number
  deliveryFeeFixed?: number
  estimatedDeliveryTime?: number
}

export interface UpdateRestaurantDto {
  name?: string
  description?: string
  phone?: string
  email?: string
  cuisine?: string[]
  openingHours?: Record<string, { open: string; close: string; isOpen: boolean }>
  deliveryRadius?: number
  minOrderAmount?: number
  deliveryFeeFixed?: number
  estimatedDeliveryTime?: number
  coverImage?: string | null
  address?: {
    street: string
    city: string
    state: string
    country?: string
    coordinates: { lat: number; lng: number }
  }
  bankDetails?: BankDetails
}

export const myRestaurantApi = {
  list: () =>
    getClient().get<ApiResponse<Restaurant[]>>('/restaurants/my/restaurants'),

  create: (dto: CreateRestaurantDto) =>
    getClient().post<ApiResponse<Restaurant>>('/restaurants', dto),

  getById: (id: string) =>
    getClient().get<ApiResponse<Restaurant>>(`/restaurants/${id}`),

  update: (id: string, dto: UpdateRestaurantDto) =>
    getClient().patch<ApiResponse<Restaurant>>(`/restaurants/${id}`, dto),

  submitForReview: (id: string) =>
    getClient().patch<ApiResponse<Restaurant>>(`/restaurants/${id}/submit-for-review`),

  getOrders: (
    restaurantId: string,
    params?: { status?: OrderStatus; page?: number; limit?: number },
  ) =>
    getClient().get<PaginatedResponse<Order>>(`/orders/restaurant/${restaurantId}`, { params }),

  getOrderById: (orderId: string) =>
    getClient().get<ApiResponse<Order>>(`/orders/${orderId}`),

  clearOrderHistory: (restaurantId: string) =>
    getClient().delete<ApiResponse<{ cleared: number }>>(`/orders/restaurant/${restaurantId}/history`),
}

// ── Menu Management (restaurant owner) ──────────────────────────────────────

export interface CreateCategoryDto {
  name: string
  description?: string
  sortOrder?: number
}

export interface CreateMenuItemDto {
  name: string
  description?: string
  price: number
  categoryId: string
  isAvailable?: boolean
  preparationTime?: number
  allergens?: string[]
  prepTimeMinutes?: number
  stockCount?: number
  lowStockThreshold?: number
}

export const menuManagementApi = {
  createCategory: (restaurantId: string, dto: CreateCategoryDto) =>
    getClient().post(`/restaurants/${restaurantId}/categories`, dto),

  updateCategory: (restaurantId: string, id: string, dto: Partial<CreateCategoryDto>) =>
    getClient().patch(`/restaurants/${restaurantId}/categories/${id}`, dto),

  deleteCategory: (restaurantId: string, id: string) =>
    getClient().delete(`/restaurants/${restaurantId}/categories/${id}`),

  createItem: (restaurantId: string, dto: CreateMenuItemDto) =>
    getClient().post(`/restaurants/${restaurantId}/menu-items`, dto),

  updateItem: (restaurantId: string, id: string, dto: Partial<CreateMenuItemDto>) =>
    getClient().patch(`/restaurants/${restaurantId}/menu-items/${id}`, dto),

  deleteItem: (restaurantId: string, id: string) =>
    getClient().delete(`/restaurants/${restaurantId}/menu-items/${id}`),
}

