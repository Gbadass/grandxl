import type { VehicleType } from './enums'
import type { GeoJSONPoint } from './user.types'

export interface RiderLocation extends GeoJSONPoint {
  bearing: number // degrees 0–359
  updatedAt: Date
}

export interface RiderEarnings {
  totalKobo: number
  pendingKobo: number
}

export interface RiderDocuments {
  idCard: string | null
  driverLicense: string | null
  vehiclePhoto: string | null
}

export interface RiderUser {
  _id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  avatar?: string
}

export interface Rider {
  _id: string
  userId: string | RiderUser
  vehicleType: VehicleType
  vehiclePlate: string | null
  isVerified: boolean
  isOnline: boolean
  isAvailable: boolean
  currentLocation: RiderLocation
  rating: number
  ratingCount: number
  totalDeliveries: number
  earnings: RiderEarnings
  documents: RiderDocuments
  isSuspended: boolean
  suspensionReason: string | null
  terminatedAt: Date | null
  terminationReason: string | null
  // Sprint 13 (S13-7): KYC review — admin can reject uploaded docs with a
  // reason. Cleared on next successful verify.
  kycRejectionReason?: string | null
  kycRejectedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}
