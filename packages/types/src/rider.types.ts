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
  createdAt: Date
  updatedAt: Date
}
