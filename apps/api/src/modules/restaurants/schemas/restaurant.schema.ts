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
}

const DayHoursSchema = SchemaFactory.createForClass(DayHoursSubdoc)
const OpeningHoursSchema = SchemaFactory.createForClass(OpeningHoursSubdoc)
const BankDetailsSchema = SchemaFactory.createForClass(BankDetailsSubdoc)

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

  // Never returned in public API responses — admin and owner only
  @Prop({
    type: BankDetailsSchema,
    default: () => ({ bankName: null, accountNumber: null, accountName: null }),
  })
  bankDetails!: BankDetailsSubdoc

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
