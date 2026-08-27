import type { RestaurantApprovalStatus, DeliveryFeeType } from './enums'
import type { GeoJSONPoint } from './user.types'

export interface OpeningHoursDay {
  open: string
  close: string
  isOpen: boolean
}

export interface OpeningHours {
  monday: OpeningHoursDay
  tuesday: OpeningHoursDay
  wednesday: OpeningHoursDay
  thursday: OpeningHoursDay
  friday: OpeningHoursDay
  saturday: OpeningHoursDay
  sunday: OpeningHoursDay
}

export interface RestaurantAddress {
  street: string
  city: string
  state: string
  country: string
  coordinates: GeoJSONPoint
}

export interface BankDetails {
  bankName: string
  accountNumber: string
  accountName: string
}

export interface Restaurant {
  _id: string
  ownerId: string
  name: string
  slug: string
  description: string
  logo: string | null
  coverImage: string | null
  gallery: string[]
  phone: string
  email: string
  cuisine: string[]
  address: RestaurantAddress
  openingHours: OpeningHours
  deliveryRadius: number
  minOrderAmount: number
  deliveryFeeType: DeliveryFeeType
  deliveryFeeFixed: number
  estimatedDeliveryTime: number
  isActive: boolean
  isOpen: boolean
  isApproved: boolean
  approvalStatus: RestaurantApprovalStatus
  approvalNote: string | null
  approvedAt: Date | null
  approvedBy: string | null
  terminatedAt: Date | null
  terminatedBy: string | null
  terminationReason: string | null
  rating: number
  ratingCount: number
  country: string
  currency: string
  bankDetails?: BankDetails
  createdAt: Date
  updatedAt: Date
}
