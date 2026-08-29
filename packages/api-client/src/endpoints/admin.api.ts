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
import type { RestaurantApprovalStatus, OrderStatus, PaymentStatus, UserRole } from '@grandxl/types'

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

  // Sprint 13 (S13-7): reject KYC with a specific reason — rider gets a
  // push and re-uploads. Verified riders can't be KYC-rejected (use suspend).
  rejectKyc: (id: string, reason: string) =>
    getClient().post<ApiResponse<Rider>>(`/admin/riders/${id}/reject-kyc`, { reason }),

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
  status?:        OrderStatus
  paymentStatus?: PaymentStatus
  search?:        string
  page?:          number
  limit?:         number
}

// Enriched row returned by GET /admin/orders and GET /admin/orders/:id — the
// aggregation joins customer, restaurant, and rider so consumers can render
// name/phone without follow-up fetches. Everything on the base Order plus
// these three.
//
// **PROJECTION WARNING**: `customer.email` is only populated by the DETAIL
// endpoint (GET /admin/orders/:id). The LIST endpoint (GET /admin/orders)
// intentionally drops it for PII data-minimization. If you're consuming a list
// row, don't read `.customer?.email` — it will always be undefined even for
// customers who have an email on file.
export interface AdminOrderRow extends Order {
  customer:   { _id: string; firstName: string; lastName: string; phone: string | null; email?: string } | null
  restaurant: { _id: string; name: string; ownerId?: string } | null
  rider:      { _id: string; firstName: string; lastName: string; phone: string | null } | null
}

export const adminOrdersApi = {
  list: (params?: AdminOrderQueryDto) =>
    getClient().get<PaginatedResponse<AdminOrderRow>>('/admin/orders', { params }),

  getById: (id: string) =>
    getClient().get<ApiResponse<AdminOrderRow>>(`/admin/orders/${id}`),

  clearAll: () =>
    getClient().delete<ApiResponse<{ cleared: number }>>('/admin/orders/all'),

  redispatch: (id: string) =>
    getClient().post<ApiResponse<{ message: string }>>(`/admin/orders/${id}/redispatch`),

  dispatchDebug: (id: string) =>
    getClient().get(`/admin/orders/${id}/dispatch-debug`),

  // Sprint 13 (S13-4): manual rider reassignment
  reassignCandidates: (id: string) =>
    getClient().get<ApiResponse<ReassignCandidate[]>>(`/admin/orders/${id}/reassign-candidates`),

  reassignRider: (id: string, riderId: string, reason?: string) =>
    getClient().post<ApiResponse<Order>>(`/admin/orders/${id}/reassign-rider`, { riderId, reason }),
}

// Sprint 13 (S13-4): shape returned by GET /admin/orders/:id/reassign-candidates
export interface ReassignCandidate {
  riderId:      string
  userId:       string
  firstName:    string
  lastName:     string
  phone:        string | null
  vehicleType:  string
  vehiclePlate: string | null
  distanceKm:   number | null
}

// ── Admin — Audit logs ──────────────────────────────────────────────────────

export interface AuditLogEntry {
  _id:         string
  actorId:     string
  actorEmail?: string
  action:      string
  targetType:  string
  targetId?:   string
  metadata?:   Record<string, unknown>
  ipAddress?:  string
  userAgent?:  string
  createdAt:   string
}

export interface AuditLogQueryDto {
  actorId?:    string
  targetType?: string
  targetId?:   string
  action?:     string
  from?:       string
  to?:         string
  page?:       number
  limit?:      number
}

export const adminAuditApi = {
  list: (params?: AuditLogQueryDto) =>
    getClient().get<PaginatedResponse<AuditLogEntry>>('/admin/audit-logs', { params }),
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

// ── Admin — Support (S13-5): force refund + emergency credit ─────────────────

export interface ForceRefundRequest {
  orderId:     string
  amountKobo?: number  // omit for full refund
  reason:      string
}

export interface ForceRefundResult {
  orderId:       string
  refundedKobo:  number
  balanceAfter:  number
}

export interface EmergencyCreditRequest {
  userId:      string
  amountKobo:  number
  reason:      string
}

export interface EmergencyCreditResult {
  userId:        string
  creditedKobo:  number
  balanceAfter:  number
}

export const adminSupportApi = {
  forceRefund: (dto: ForceRefundRequest) =>
    getClient().post<ApiResponse<ForceRefundResult>>('/admin/support/force-refund', dto),

  emergencyCredit: (dto: EmergencyCreditRequest) =>
    getClient().post<ApiResponse<EmergencyCreditResult>>('/admin/support/emergency-credit', dto),
}

// ── Admin — Broadcasts (S13-8) ───────────────────────────────────────────────

export interface CreateBroadcastRequest {
  audiences:  UserRole[]  // one or more of customer / rider / restaurant_owner
  title:      string
  body:       string
  actionUrl?: string
}

export interface CreateBroadcastResult {
  broadcastId:    string
  recipientCount: number
  deliveredCount: number
}

export interface BroadcastHistoryRow {
  _id:            string
  actorId:        string | { firstName?: string; lastName?: string }
  audiences:      UserRole[]
  title:          string
  body:           string
  actionUrl:      string | null
  recipientCount: number
  deliveredCount: number
  sentAt:         Date
  createdAt:      Date
}

export const adminBroadcastsApi = {
  send: (dto: CreateBroadcastRequest) =>
    getClient().post<ApiResponse<CreateBroadcastResult>>('/admin/broadcasts', dto),

  list: (params?: { page?: number; limit?: number }) =>
    getClient().get<ApiResponse<{
      items: BroadcastHistoryRow[]
      total: number
      page:  number
      limit: number
      pages: number
    }>>('/admin/broadcasts', { params }),
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
  // Sprint 12 (S12-9): photo gallery URLs (max 12 enforced server-side)
  gallery?: string[]
  // Sprint 12 (S12-10): date-specific overrides (max 90 enforced server-side)
  specialHours?: Array<{
    date:      string
    isClosed:  boolean
    open?:     string | null
    close?:    string | null
    note?:     string | null
  }>
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
  calories?: number
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

  // ── Sprint 12 (S12-7): bulk edit ─────────────────────────────────────

  bulkSetAvailability: (restaurantId: string, itemIds: string[], isAvailable: boolean) =>
    getClient().post<ApiResponse<{ modifiedCount: number }>>(
      `/restaurants/${restaurantId}/menu-items/bulk-availability`,
      { itemIds, isAvailable },
    ),

  bulkSetFeatured: (restaurantId: string, itemIds: string[], isFeatured: boolean) =>
    getClient().post<ApiResponse<{ modifiedCount: number }>>(
      `/restaurants/${restaurantId}/menu-items/bulk-featured`,
      { itemIds, isFeatured },
    ),

  bulkMoveCategory: (restaurantId: string, itemIds: string[], categoryId: string) =>
    getClient().post<ApiResponse<{ modifiedCount: number }>>(
      `/restaurants/${restaurantId}/menu-items/bulk-category`,
      { itemIds, categoryId },
    ),

  bulkAdjustPrice: (
    restaurantId: string,
    itemIds: string[],
    mode: 'percent' | 'fixed' | 'set',
    value: number,
  ) =>
    getClient().post<ApiResponse<{ modifiedCount: number }>>(
      `/restaurants/${restaurantId}/menu-items/bulk-price`,
      { itemIds, mode, value },
    ),

  bulkDelete: (restaurantId: string, itemIds: string[]) =>
    getClient().post<ApiResponse<{ deletedCount: number }>>(
      `/restaurants/${restaurantId}/menu-items/bulk-delete`,
      { itemIds },
    ),
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

// ── Sprint 12 (S12-5): Financial report ─────────────────────────────────────

export interface FinancialReportTotals {
  ordersDelivered: number
  ordersCancelled: number
  ordersRefunded:  number
  grossKobo:       number
  netKobo:         number
  subtotalKobo:    number
  deliveryFeeKobo: number
  serviceFeeKobo:  number
  discountKobo:    number
  vatKobo:         number
  tipKobo:         number
  refundedKobo:    number
  avgOrderKobo:    number
}

export interface FinancialReportPaymentRow {
  method:    'paystack' | 'wallet' | 'cash'
  orders:    number
  grossKobo: number
  netKobo:   number
}

export interface FinancialReportCancelRow {
  code:  string | null
  label: string
  count: number
}

export interface FinancialReportDailyRow {
  date:            string
  orders:          number
  grossKobo:       number
  netKobo:         number
  deliveryFeeKobo: number
  serviceFeeKobo:  number
  discountKobo:    number
}

export interface FinancialReportData {
  period:         { from: string; to: string; days: number }
  previousPeriod: { from: string; to: string }
  totals:         FinancialReportTotals
  previousTotals: { ordersDelivered: number; grossKobo: number }
  byPaymentMethod: FinancialReportPaymentRow[]
  byCancelReason:  FinancialReportCancelRow[]
  daily:           FinancialReportDailyRow[]
}

export const analyticsApi = {
  getPlatform: () =>
    getClient().get<ApiResponse<PlatformAnalyticsData>>('/admin/analytics'),

  getRestaurant: (restaurantId: string) =>
    getClient().get<ApiResponse<RestaurantAnalyticsData>>('/restaurant/analytics', {
      params: { restaurantId },
    }),

  getRestaurantFinancialReport: (restaurantId: string, from?: string, to?: string) =>
    getClient().get<ApiResponse<FinancialReportData>>('/restaurant/financial-report', {
      params: { restaurantId, from, to },
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
