// Singleton platform config document (Part 37.2)
export interface DeliveryTier {
  maxKm: number
  feeKobo: number
}

export interface PlatformConfig {
  _id: string
  deliveryTiers: DeliveryTier[]
  platformCommissionPercent: number
  minRiderEarningKobo: number
  enabledServices: {
    instamart: boolean
    dineout: boolean
    drinks: boolean
  }
  updatedAt: Date
}

// Wallet types (Part 32)
export interface Wallet {
  _id: string
  userId: string
  balance: number // kobo
  currency: string
  createdAt: Date
  updatedAt: Date
}

export interface WalletTransaction {
  _id: string
  walletId: string
  type: 'credit' | 'debit'
  amount: number // kobo
  description: string
  reference: string
  balanceBefore: number // kobo
  balanceAfter: number // kobo
  createdAt: Date
}

// Coupon types (Part 33)
export interface Coupon {
  _id: string
  code: string
  type: 'percentage' | 'fixed_amount' | 'free_delivery'
  value: number
  minOrderAmount: number // kobo
  maxDiscount: number // kobo
  usageLimit: number
  usageCount: number
  perUserLimit: number
  applicableRestaurants: string[]
  startDate: Date
  endDate: Date
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface CouponValidationResult {
  valid: boolean
  discountAmount: number // kobo
  finalTotal: number // kobo
  errorMessage?: string
}

// Review types
export interface Review {
  _id: string
  customerId: string
  restaurantId: string
  orderId: string
  restaurantRating: number // 1–5
  riderRating: number | null // 1–5
  foodRating: number | null // 1–5
  comment: string | null
  isVisible: boolean
  createdAt: Date
  updatedAt: Date
}
