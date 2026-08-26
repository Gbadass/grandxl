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

export interface TerminateRestaurantDto {
  reason: string
}

export interface RequestMoreInfoDto {
  message: string
}

export interface AdminOnboardRestaurantDto {
  ownerPhone: string
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
  ownerPassword?: string
  name: string
  phone: string
  email?: string
  description?: string
  cuisine: string[]
  address: {
    street: string
    city: string
    state: string
    country?: string
    lat?: number
    lng?: number
  }
  minOrderAmount?: number
  estimatedDeliveryTime?: number
  deliveryFeeFixed?: number
  deliveryRadius?: number
}

export const adminRestaurantsApi = {
  list: (params?: AdminRestaurantQueryDto) =>
    getClient().get<PaginatedResponse<Restaurant>>('/admin/restaurants', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Restaurant>>(`/admin/restaurants/${id}`),

  onboard: (dto: AdminOnboardRestaurantDto) =>
    getClient().post<ApiResponse<Restaurant>>('/admin/restaurants', dto),

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

  terminate: (id: string, dto: TerminateRestaurantDto) =>
    getClient().patch<ApiResponse<Restaurant>>(`/admin/restaurants/${id}/terminate`, dto),
}

// ── Admin — Riders ───────────────────────────────────────────────────────────

export interface AdminOnboardRiderDto {
  riderPhone: string
  riderFirstName?: string
  riderLastName?: string
  riderEmail?: string
  riderPassword?: string
  vehicleType: 'motorcycle' | 'bicycle' | 'car'
  vehiclePlate?: string
}

export interface SuspendRiderDto {
  reason: string
}

export interface TerminateRiderDto {
  reason: string
}

export const adminRidersApi = {
  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<PaginatedResponse<Rider>>('/admin/riders', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<Rider>>(`/admin/riders/${id}`),

  onboard: (dto: AdminOnboardRiderDto) =>
    getClient().post<ApiResponse<Rider>>('/admin/riders', dto),

  verify: (id: string) =>
    getClient().post<ApiResponse<Rider>>(`/admin/riders/${id}/verify`),

  suspend: (id: string, dto: SuspendRiderDto) =>
    getClient().patch<ApiResponse<Rider>>(`/admin/riders/${id}/suspend`, dto),

  reinstate: (id: string) =>
    getClient().patch<ApiResponse<Rider>>(`/admin/riders/${id}/reinstate`),

  terminate: (id: string, dto: TerminateRiderDto) =>
    getClient().patch<ApiResponse<Rider>>(`/admin/riders/${id}/terminate`, dto),

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

  redispatch: (id: string) =>
    getClient().post<ApiResponse<{ message: string }>>(`/admin/orders/${id}/redispatch`),

  dispatchDebug: (id: string) =>
    getClient().get(`/admin/orders/${id}/dispatch-debug`),
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

export interface AdminCreateUserDto {
  firstName: string
  lastName: string
  phone?: string
  email?: string
  password: string
  roles: string[]
  country?: string
}

export const adminUsersApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    getClient().get<PaginatedResponse<User>>('/admin/users', { params }),

  create: (dto: AdminCreateUserDto) =>
    getClient().post<ApiResponse<User>>('/admin/users', dto),

  ban: (id: string) =>
    getClient().patch<ApiResponse<{ banned: boolean }>>(`/admin/users/${id}/ban`),

  unban: (id: string) =>
    getClient().patch<ApiResponse<{ banned: boolean }>>(`/admin/users/${id}/unban`),

  delete: (id: string) =>
    getClient().delete<ApiResponse<{ deleted: boolean }>>(`/admin/users/${id}`),
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
  logo?: string | null
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

export interface CreateMenuItemVariantOption {
  name: string
  priceAdjustment: number // in kobo
}

export interface CreateMenuItemVariant {
  name: string
  isRequired: boolean
  options: CreateMenuItemVariantOption[]
}

export interface CreateMenuItemAddOn {
  name: string
  price: number // in kobo
  isAvailable: boolean
}

export interface CreateMenuItemDto {
  name: string
  description?: string
  basePrice: number
  categoryId: string
  isAvailable?: boolean
  isPopular?: boolean
  sortOrder?: number
  allergens?: string[]
  prepTimeMinutes?: number
  stockCount?: number
  lowStockThreshold?: number
  image?: string
  variants?: CreateMenuItemVariant[]
  addOns?: CreateMenuItemAddOn[]
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

// ── Analytics ────────────────────────────────────────────────────────────────

export interface PlatformAnalyticsData {
  orders: {
    total: number
    completed: number
    cancelled: number
    completionRate: number
  }
  revenue: {
    totalKobo: number
    commissionKobo: number
  }
  restaurants: { total: number; active: number }
  riders: { total: number; active: number }
  dailyOrders: Array<{ _id: string; count: number; revenue: number }>
  topRestaurants: Array<{ name: string; orderCount: number; revenue: number }>
}

export interface RestaurantAnalyticsData {
  orders: {
    total: number
    completed: number
    cancelled: number
    completionRate: number
  }
  revenue: {
    totalKobo: number
    avgOrderKobo: number
  }
  dailyOrders: Array<{ _id: string; count: number; revenue: number }>
  topItems: Array<{ name: string; count: number; revenue: number }>
}

export interface DispatchMetricsData {
  periodDays: number
  assignedOrders: number
  avgWaitSeconds: number
  minWaitSeconds: number
  maxWaitSeconds: number
  avgDispatchRounds: number
  avgBroadcastCount: number
  totalDispatchedOrders: number
  forceAssignCount: number
  noRiderCount: number
}

export interface QueueDepthData {
  queues: Record<string, { waiting: number; active: number; delayed: number; failed: number }>
}

export interface HeatmapPoint {
  lat: number
  lng: number
  count: number
}

export interface HeatmapData {
  periodDays: number
  points: HeatmapPoint[]
}

export interface OrderTimeoutData {
  periodDays: number
  totalOrders: number
  totalTimeouts: number
  timeoutRate: number
  byReason: Record<string, number>
}

export interface RestaurantEngagementRow {
  restaurantId: string
  name?: string
  total: number
  engaged: number
  engagementRate: number
}

export interface RestaurantEngagementData {
  periodDays: number
  totalOrders: number
  engagedOrders: number
  engagementRate: number
  acceptedCount: number
  readyCount: number
  rejectedCount: number
  worstRestaurants: RestaurantEngagementRow[]
}

export interface RestaurantWaitTimeRow {
  restaurantId: string
  name?: string
  avgWaitSeconds: number
  maxWaitSeconds: number
  orderCount: number
}

export interface RestaurantWaitTimeData {
  periodDays: number
  restaurants: RestaurantWaitTimeRow[]
}

export interface RiderUtilizationRow {
  riderId: string
  busySeconds: number
  onlineSeconds: number
  utilization: number
  deliveries: number
}

export interface RiderUtilizationData {
  periodDays: number
  riderCount: number
  avgUtilization: number
  totalBusyHours: number
  totalOnlineHours: number
  topRiders: RiderUtilizationRow[]
  bottomRiders: RiderUtilizationRow[]
}

export const analyticsApi = {
  getPlatform: () =>
    getClient().get<ApiResponse<PlatformAnalyticsData>>('/admin/analytics'),

  getRestaurant: (restaurantId: string) =>
    getClient().get<ApiResponse<RestaurantAnalyticsData>>('/restaurant/analytics', {
      params: { restaurantId },
    }),

  getDispatchMetrics: (days = 7) =>
    getClient().get<ApiResponse<DispatchMetricsData>>('/admin/analytics/dispatch', {
      params: { days },
    }),

  getQueueDepth: () =>
    getClient().get<ApiResponse<QueueDepthData>>('/admin/analytics/queue-depth'),

  getHeatmap: (days = 30) =>
    getClient().get<ApiResponse<HeatmapData>>('/admin/analytics/heatmap', {
      params: { days },
    }),

  getOrderTimeouts: (days = 7) =>
    getClient().get<ApiResponse<OrderTimeoutData>>('/admin/analytics/order-timeouts', {
      params: { days },
    }),

  getRestaurantEngagement: (days = 30) =>
    getClient().get<ApiResponse<RestaurantEngagementData>>('/admin/analytics/restaurant-engagement', {
      params: { days },
    }),

  getRestaurantWaitTimes: (days = 30) =>
    getClient().get<ApiResponse<RestaurantWaitTimeData>>('/admin/analytics/restaurant-wait-times', {
      params: { days },
    }),

  getRiderUtilization: (days = 7) =>
    getClient().get<ApiResponse<RiderUtilizationData>>('/admin/analytics/rider-utilization', {
      params: { days },
    }),
}
