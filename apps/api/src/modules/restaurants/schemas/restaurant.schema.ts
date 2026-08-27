import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { RestaurantApprovalStatus, DeliveryFeeType } from '@grandxl/types'

@Schema({ _id: false })
class DayHoursSubdoc {
  @Prop({ type: String }) open!: string
  @Prop({ type: String }) close!: string
  @Prop({ type: Boolean }) isOpen!: boolean
}

@Schema({ _id: false })
class OpeningHoursSubdoc {
  @Prop({ type: DayHoursSubdoc }) monday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) tuesday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) wednesday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) thursday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) friday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) saturday!: DayHoursSubdoc
  @Prop({ type: DayHoursSubdoc }) sunday!: DayHoursSubdoc
}

@Schema({ _id: false })
class BankDetailsSubdoc {
  @Prop({ type: String, default: null }) bankName!: string | null
  @Prop({ type: String, default: null }) accountNumber!: string | null
  @Prop({ type: String, default: null }) accountName!: string | null

  // Sprint 12 (S12-6): Paystack code for the selected bank + recipient handle.
  // Populated when the owner saves bank details through the restaurant portal so
  // we don't have to re-create the Paystack transfer recipient on every payout.
  @Prop({ type: String, default: null }) bankCode!: string | null
  @Prop({ type: String, default: null }) paystackRecipientCode!: string | null
}

// Sprint 12 (S12-6): mirror of the rider EarningsSubdoc. `pendingKobo` accumulates
// on DELIVERED (in the 24h dispute window). `settleEarnings` moves it to `totalKobo`
// after the window elapses. `totalKobo` is what the restaurant can request as a
// payout — same lifecycle as rider earnings.
@Schema({ _id: false })
class EarningsSubdoc {
  @Prop({ type: Number, default: 0, min: 0 }) totalKobo!: number
  @Prop({ type: Number, default: 0, min: 0 }) pendingKobo!: number
}

const DayHoursSchema = SchemaFactory.createForClass(DayHoursSubdoc)
const OpeningHoursSchema = SchemaFactory.createForClass(OpeningHoursSubdoc)
const BankDetailsSchema = SchemaFactory.createForClass(BankDetailsSubdoc)
const EarningsSchema = SchemaFactory.createForClass(EarningsSubdoc)

const DEFAULT_DAY = { open: '09:00', close: '22:00', isOpen: true }
const DEFAULT_OPENING_HOURS = () => ({
  monday: DEFAULT_DAY, tuesday: DEFAULT_DAY, wednesday: DEFAULT_DAY,
  thursday: DEFAULT_DAY, friday: DEFAULT_DAY, saturday: DEFAULT_DAY,
  sunday: { ...DEFAULT_DAY, isOpen: false },
})

@Schema({ timestamps: true, collection: 'restaurants' })
export class RestaurantDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId!: Types.ObjectId

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ lowercase: true })
  slug!: string

  @Prop({ default: '' })
  description!: string

  @Prop({ type: String, default: null })
  logo!: string | null

  @Prop({ type: String, default: null })
  coverImage!: string | null

  // Sprint 12 (S12-9): photo gallery. Additional Cloudinary URLs beyond the
  // single hero coverImage — dining room, plated dishes, chef portrait, etc.
  // Capped at 12 by the DTO; storing the array preserves owner-defined order
  // so it's the same on the customer-facing strip and the lightbox.
  @Prop({ type: [String], default: [] })
  gallery!: string[]

  @Prop({ required: true })
  phone!: string

  @Prop({ default: '' })
  email!: string

  @Prop({ type: [String], default: [] })
  cuisine!: string[]

  @Prop({
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, default: 'NG' },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },
    required: true,
  })
  address!: {
    street: string
    city: string
    state: string
    country: string
    coordinates: { type: 'Point'; coordinates: [number, number] }
  }

  @Prop({ type: OpeningHoursSchema, default: DEFAULT_OPENING_HOURS })
  openingHours!: OpeningHoursSubdoc

  @Prop({ default: 5 })
  deliveryRadius!: number // km

  @Prop({ default: 0 })
  minOrderAmount!: number // kobo

  @Prop({ type: String, enum: DeliveryFeeType, default: DeliveryFeeType.FIXED })
  deliveryFeeType!: DeliveryFeeType

  @Prop({ default: 100000 }) // ₦1,000
  deliveryFeeFixed!: number // kobo

  @Prop({ default: 30 })
  estimatedDeliveryTime!: number // minutes

  @Prop({ default: true })
  isActive!: boolean

  @Prop({ default: false })
  isOpen!: boolean

  @Prop({ default: false })
  isApproved!: boolean

  @Prop({
    type: String,
    enum: RestaurantApprovalStatus,
    default: RestaurantApprovalStatus.PENDING_REVIEW,
  })
  approvalStatus!: RestaurantApprovalStatus

  @Prop({ type: String, default: null })
  approvalNote!: string | null

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  terminatedAt!: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  terminatedBy!: Types.ObjectId | null

  @Prop({ type: String, default: null })
  terminationReason!: string | null

  @Prop({ default: 0 })
  rating!: number

  @Prop({ default: 0 })
  ratingCount!: number

  @Prop({ default: 'NG' })
  country!: string

  @Prop({ default: 'NGN' })
  currency!: string

  // IANA timezone name (e.g. 'Africa/Lagos', 'Africa/Nairobi'). Used to interpret
  // openingHours in the restaurant's LOCAL time — otherwise a restaurant in Kenya
  // would appear open/closed on Lagos time. Defaults to Africa/Lagos for Nigerian
  // launch; owner can override in settings for expansion.
  @Prop({ default: 'Africa/Lagos' })
  timezone!: string

  // Never returned in public API responses — admin and owner only
  @Prop({
    type: BankDetailsSchema,
    default: () => ({
      bankName: null, accountNumber: null, accountName: null,
      bankCode: null, paystackRecipientCode: null,
    }),
  })
  bankDetails!: BankDetailsSubdoc

  // Sprint 12 (S12-6): earnings pipeline. Only exposed to the restaurant owner
  // via /restaurant/payouts. Legacy documents predate this field — the default
  // makes reads safe until we backfill.
  @Prop({
    type: EarningsSchema,
    default: () => ({ totalKobo: 0, pendingKobo: 0 }),
  })
  earnings!: EarningsSubdoc

  createdAt!: Date
  updatedAt!: Date
}

export const RestaurantSchema = SchemaFactory.createForClass(RestaurantDocument)

// Geospatial index for nearby restaurant queries
RestaurantSchema.index({ 'address.coordinates': '2dsphere' })

// Unique slug
RestaurantSchema.index({ slug: 1 }, { unique: true })

// Owner lookup
RestaurantSchema.index({ ownerId: 1 })

// Customer-facing filtered queries
RestaurantSchema.index({ country: 1, isActive: 1, isApproved: 1 })

// Cuisine filter
RestaurantSchema.index({ cuisine: 1 })

// Rating sort
RestaurantSchema.index({ rating: -1 })

// Full-text search (Part 3 — used by SearchModule)
RestaurantSchema.index({ name: 'text', description: 'text', cuisine: 'text' })
