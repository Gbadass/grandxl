import type { UserRole } from './enums'

export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface Address {
  _id: string
  label: string
  street: string
  city: string
  state: string
  country: string
  coordinates: GeoJSONPoint
  instructions: string | null
}

export interface RiskFlag {
  code: string       // machine-readable identifier, e.g. 'payment_failures_24h'
  reason: string     // human-readable justification shown to admins
  createdAt: Date
}

export interface User {
  _id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  roles: UserRole[]
  isVerified: boolean
  isActive: boolean
  avatar: string | null
  expoPushToken: string | null
  addresses: Address[]
  defaultAddressId: string | null
  country: string
  currency: string
  locale: string
  consentGiven: boolean
  consentDate: Date | null
  lastLoginAt: Date | null
  deletedAt: Date | null
  // Ban context — populated only when isActive=false. `bannedBy` is populated
  // with actor first/last name on the blocklist endpoint, plain ObjectId
  // elsewhere.
  banReason?: string | null
  bannedAt?: Date | null
  bannedBy?: string | { _id: string; firstName?: string; lastName?: string } | null
  // Auto-populated by FraudService when suspicious activity is detected.
  // Optional in the type because most callers don't select it, but the API
  // always returns it as an array (never undefined) — the schema default is [].
  riskFlags?: RiskFlag[]
  createdAt: Date
  updatedAt: Date
}

export interface JwtPayload {
  sub: string
  roles: UserRole[]
  country: string
  familyId?: string
  jti?: string
  iat?: number
  exp?: number
}
