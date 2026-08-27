import type { OrderStatus, PaymentMethod, PaymentStatus } from './enums'
import type { GeoJSONPoint } from './user.types'

// Canonical codes for structured order cancellations (Sprint 12 — S12-1).
// The human-readable `cancelReason` text is still stored for backward compat
// and free-text "other" notes, but analytics and customer messaging should
// prefer the code.
export type CancelReasonCode =
  | 'out_of_stock'
  | 'item_unavailable'
  | 'too_busy'
  | 'closing_soon'
  | 'outside_delivery_area'
  | 'duplicate_order'
  | 'customer_request'
  | 'payment_issue'
  | 'other'

export interface OrderItemVariant {
  variantName: string
  optionName: string
  priceAdjustment: number // kobo
}

export interface OrderItemAddOn {
  name: string
  price: number // kobo
}

export interface OrderItem {
  menuItemId: string
  name: string // snapshot at order time
  image: string | null // snapshot at order time
  basePrice: number // kobo — snapshot at order time
  quantity: number
  selectedVariants: OrderItemVariant[]
  selectedAddOns: OrderItemAddOn[]
  itemTotal: number // kobo — computed and stored
  note: string | null
}

export interface OrderDeliveryAddress {
  street: string
  city: string
  state: string
  coordinates: GeoJSONPoint
}

export interface OrderPricing {
  subtotal: number // kobo
  deliveryFee: number // kobo
  serviceFee: number // kobo
  discount: number // kobo
  vat: number // kobo — 0 at launch
  tip: number // kobo — 100% goes to rider on top of delivery fee
  walletApplied: number // kobo — debited from wallet at order create
  total: number // kobo (paystack charges total - walletApplied)
}

export interface OrderPayment {
  method: PaymentMethod
  status: PaymentStatus
  reference: string | null
  paidAt: Date | null
}

export interface OrderCoupon {
  code: string | null
  discountAmount: number // kobo
}

export interface Order {
  _id: string
  orderNumber: string // GXL-YYYYMMDD-XXXX
  customerId: string
  restaurantId: string
  restaurantName: string
  riderId: string | null
  status: OrderStatus
  items: OrderItem[]
  deliveryAddress: OrderDeliveryAddress
  restaurantPickupAddress: OrderDeliveryAddress | null
  pricing: OrderPricing
  payment: OrderPayment
  coupon: OrderCoupon
  customerNote: string | null
  deliveryInstructions: string | null
  estimatedTime: number | null // minutes
  actualDeliveryAt: Date | null
  cancelReason: string | null
  cancelReasonCode: CancelReasonCode | null
  timeoutJobId: string | null
  scheduledFor: Date | null
  // Sprint 12 (S12-11): straight-line distance restaurant→customer at order create
  deliveryDistanceKm?: number | null
  // Sprint 12 (S12-11): true when customer accepted an out-of-normal-range delivery
  isFarDelivery?: boolean
  country: string
  currency: string
  createdAt: Date
  updatedAt: Date
}

// Cart item — stored in Zustand, computed itemTotal trusted only for display
export interface CartItem {
  menuItemId: string
  restaurantId: string
  name: string
  image: string | null
  basePrice: number // kobo
  quantity: number
  selectedVariants: OrderItemVariant[]
  selectedAddOns: OrderItemAddOn[]
  itemTotal: number // kobo — display only, backend recomputes
  note: string | null
}
