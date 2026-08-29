import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { Exclude, Transform, Type } from 'class-transformer'
import { UserRole } from '@grandxl/types'

@Schema({ _id: true })
export class AddressSubdocument {
  @Transform(({ obj }) => obj._id.toString())
  _id!: Types.ObjectId

  @Prop({ required: true, trim: true })
  label!: string

  @Prop({ required: true, trim: true })
  street!: string

  @Prop({ required: true, trim: true })
  city!: string

  @Prop({ required: true, trim: true })
  state!: string

  @Prop({ default: 'NG' })
  country!: string

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: { type: [Number] },
  })
  coordinates!: { type: 'Point'; coordinates: [number, number] }

  @Prop({ type: String, default: null })
  instructions!: string | null
}

const AddressSchema = SchemaFactory.createForClass(AddressSubdocument)

@Schema({ timestamps: true, collection: 'users' })
export class UserDocument extends Document {
  @Prop({ required: true, trim: true })
  firstName!: string

  @Prop({ required: true, trim: true })
  lastName!: string

  @Prop({ type: String, lowercase: true, trim: true })
  email?: string | null

  @Prop({ type: String, trim: true })
  phone?: string | null

  @Prop({ type: String, default: null })
  @Exclude()
  passwordHash!: string | null

  @Prop({ type: [String], enum: UserRole, default: [UserRole.CUSTOMER] })
  roles!: UserRole[]

  @Prop({ default: false })
  isVerified!: boolean

  @Prop({ default: true })
  isActive!: boolean

  @Prop({ type: String, default: null })
  avatar!: string | null

  @Prop({ type: String, default: null })
  expoPushToken!: string | null

  // Web Push (VAPID) subscriptions — one per browser/device
  @Prop({
    type: [{
      endpoint:   { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
      },
    }],
    default: [],
  })
  webPushSubscriptions!: Array<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  }>

  @Type(() => AddressSubdocument)
  @Prop({ type: [AddressSchema], default: [] })
  addresses!: AddressSubdocument[]

  @Prop({ type: Types.ObjectId, default: null })
  defaultAddressId!: Types.ObjectId | null

  // Restaurant favorites — small array (typical user favourites <20 restaurants).
  // If size becomes a concern we move to a separate collection.
  @Prop({ type: [Types.ObjectId], ref: 'RestaurantDocument', default: [] })
  favoriteRestaurantIds!: Types.ObjectId[]

  @Prop({ default: 'NG' })
  country!: string

  @Prop({ default: 'NGN' })
  currency!: string

  @Prop({ default: 'en-NG' })
  locale!: string

  @Prop({ default: false })
  consentGiven!: boolean

  @Prop({ type: Date, default: null })
  consentDate!: Date | null

  // Transactional SMS opt-in. Defaults true so existing users keep receiving
  // order status SMS. Users can set false via PATCH /users/me/preferences.
  @Prop({ default: true })
  smsOptIn!: boolean

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null

  @Prop({ type: String, default: null })
  referralCode!: string | null

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', default: null })
  referredBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null

  // Risk flags — auto-populated by FraudService when suspicious activity is
  // detected. Admin can inspect and clear. Each entry is short-lived (rules
  // define TTL implicitly by re-evaluating on each check).
  @Prop({
    type: [{
      code:      { type: String, required: true }, // e.g. 'payment_failures_24h'
      reason:    { type: String, required: true },
      createdAt: { type: Date,   default: Date.now },
    }],
    default: [],
  })
  riskFlags!: { code: string; reason: string; createdAt: Date }[]

  // Injected by Mongoose timestamps
  createdAt!: Date
  updatedAt!: Date
}

export const UserSchema = SchemaFactory.createForClass(UserDocument)

// Indexes — declared explicitly per Part 5
UserSchema.index({ email: 1 }, { unique: true, sparse: true })
UserSchema.index({ phone: 1 }, { unique: true, sparse: true })
UserSchema.index({ roles: 1 })
UserSchema.index({ isActive: 1 })
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true })
// Support admin order-ops search: aggregation $lookup joins users onto orders
// then regex-matches customer.firstName / lastName. Without these, a common
// name search scans the entire users collection per query.
UserSchema.index({ firstName: 1 })
UserSchema.index({ lastName: 1 })
