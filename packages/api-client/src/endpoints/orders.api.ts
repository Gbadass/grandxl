import { getClient } from '../client'
import type { ApiResponse, PaginatedResponse, Order } from '@grandxl/types'
import type { PaymentMethod } from '@grandxl/types'
import { OrderStatus } from '@grandxl/types'

export interface CreateOrderDto {
  restaurantId: string
  items: {
    menuItemId: string
    quantity: number
    selectedVariants?: { variantName: string; optionName: string; priceAdjustment: number }[]
    selectedAddOns?: { name: string; price: number }[]
    note?: string
  }[]
  deliveryAddress: {
    street: string
    city: string
    state: string
    coordinates: { lat: number; lng: number }
  }
  paymentMethod: PaymentMethod
  couponCode?: string
  tip?: number      // kobo — 100% to rider on top of delivery fee
  useWallet?: boolean
  // ISO datetime; must be 60min–7d in the future. Omit for "order now".
  scheduledFor?: string
  customerNote?: string
  deliveryInstructions?: string
}

export interface UpdateOrderStatusDto {
  status: OrderStatus
  cancelReason?: string
  // Required when transitioning a CASH order to DELIVERED — rider PWA confirms
  // via a modal that they collected cash. Otherwise the API rejects the update.
  cashCollected?: boolean
  // Cloudinary URL from POST /uploads/delivery-proof. Required for COD orders,
  // optional for card. Rendered in admin order detail for dispute resolution.
  deliveryProofUrl?: string
}

export interface RiderContact {
  riderId: string
  firstName: string
  lastName: string
  phone: string | null
  vehicleType: string | null
  vehiclePlate: string | null
}

export interface CustomerContact {
  customerId: string
  firstName: string
  lastName: string
  phone: string | null
}

export const ordersApi = {
  // Pass an `idempotencyKey` to dedupe network retries — same key + same body returns
  // the original response instead of creating a second order.
  create: (dto: CreateOrderDto, idempotencyKey?: string) =>
    getClient().post<ApiResponse<Order>>(
      '/orders',
      dto,
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),

  getById: (id: string) =>
    getClient().get<ApiResponse<Order>>(`/orders/my/${id}`),

  getHistory: (params?: { page?: number; limit?: number; status?: OrderStatus }) =>
    getClient().get<PaginatedResponse<Order>>('/orders/my', { params }),

  updateStatus: (id: string, dto: UpdateOrderStatusDto) =>
    getClient().patch<ApiResponse<Order>>(`/orders/${id}/status`, dto),

  cancel: (id: string, reason?: string) =>
    getClient().patch<ApiResponse<Order>>(`/orders/${id}/status`, {
      status: OrderStatus.CANCELLED,
      cancelReason: reason,
    }),

  getRiderContact: (id: string) =>
    getClient().get<ApiResponse<RiderContact>>(`/orders/${id}/rider-contact`),

  getCustomerContact: (id: string) =>
    getClient().get<ApiResponse<CustomerContact>>(`/orders/${id}/customer-contact`),
}
