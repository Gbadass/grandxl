import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { OrderStatus, PaymentMethod, PaymentStatus } from '@grandxl/types'

@Schema({ _id: false })
class OrderItemVariantSubdoc {
  @Prop({ required: true }) variantName!: string
  @Prop({ required: true }) optionName!: string
  @Prop({ required: true, min: 0 }) priceAdjustment!: number
}

@Schema({ _id: false })
class OrderItemAddOnSubdoc {
  @Prop({ required: true }) name!: string
  @Prop({ required: true, min: 0 }) price!: number
}

@Schema({ _id: false })
class OrderItemSubdoc {
  @Prop({ type: Types.ObjectId, required: true }) menuItemId!: Types.ObjectId
  @Prop({ required: true }) name!: string
  @Prop({ type: String, default: null }) image!: string | null
  @Prop({ required: true, min: 0 }) basePrice!: number
  @Prop({ required: true, min: 1 }) quantity!: number
  @Prop({ type: [OrderItemVariantSubdoc], default: [] }) selectedVariants!: OrderItemVariantSubdoc[]
  @Prop({ type: [OrderItemAddOnSubdoc], default: [] }) selectedAddOns!: OrderItemAddOnSubdoc[]
  @Prop({ required: true, min: 0 }) itemTotal!: number
  @Prop({ type: String, default: null }) note!: string | null
}

@Schema({ _id: false })
class DeliveryAddressSubdoc {
  @Prop({ required: true }) street!: string
  @Prop({ required: true }) city!: string
  @Prop({ required: true }) state!: string
  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  })
  coordinates!: { type: 'Point'; coordinates: [number, number] }
}

@Schema({ _id: false })
class PricingSubdoc {
  @Prop({ required: true, min: 0 }) subtotal!: number
  @Prop({ required: true, min: 0 }) deliveryFee!: number
  @Prop({ required: true, min: 0 }) serviceFee!: number
  @Prop({ required: true, min: 0 }) discount!: number
  @Prop({ required: true, min: 0 }) vat!: number
  @Prop({ required: true, min: 0, default: 0 }) tip!: number // kobo — 100% goes to rider, separate from delivery fee
  @Prop({ required: true, min: 0, default: 0 }) walletApplied!: number // kobo — debited from wallet at order create
  @Prop({ required: true, min: 0 }) total!: number
}

@Schema({ _id: false })
class PaymentSubdoc {
  @Prop({ required: true, enum: Object.values(PaymentMethod) }) method!: PaymentMethod
  @Prop({ required: true, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING })
  status!: PaymentStatus
  @Prop({ type: String, default: null }) reference!: string | null
  @Prop({ type: Date, default: null }) paidAt!: Date | null
}

@Schema({ _id: false })
class CouponSubdoc {
  @Prop({ type: String, default: null }) code!: string | null
  @Prop({ required: true, min: 0, default: 0 }) discountAmount!: number
}

@Schema({ timestamps: true, collection: 'orders' })
export class OrderDocument extends Document {
  @Prop({ required: true, unique: true, index: true })
  orderNumber!: string // GXL-YYYYMMDD-XXXX

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  customerId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', required: true })
  restaurantId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'RiderDocument', default: null })
  riderId!: Types.ObjectId | null

  @Prop({ required: true, enum: Object.values(OrderStatus), default: OrderStatus.PENDING })
  status!: OrderStatus

  @Prop({ type: [OrderItemSubdoc], required: true })
  items!: OrderItemSubdoc[]

  @Prop({ type: DeliveryAddressSubdoc, required: true })
  deliveryAddress!: DeliveryAddressSubdoc

  // Snapshotted at order creation — rider uses this for Phase 1 navigation (head to restaurant)
  @Prop({ type: DeliveryAddressSubdoc, default: null })
  restaurantPickupAddress!: DeliveryAddressSubdoc | null

  @Prop({ type: PricingSubdoc, required: true })
  pricing!: PricingSubdoc

  @Prop({ type: PaymentSubdoc, required: true })
  payment!: PaymentSubdoc

  @Prop({ type: CouponSubdoc, default: () => ({ code: null, discountAmount: 0 }) })
  coupon!: CouponSubdoc

  @Prop({ type: String, default: null })
  customerNote!: string | null

  @Prop({ type: Number, default: null })
  estimatedTime!: number | null // minutes

  @Prop({ type: Date, default: null })
  actualDeliveryAt!: Date | null

  @Prop({ type: String, default: null })
  cancelReason!: string | null

  @Prop({ type: String, default: null })
  timeoutJobId!: string | null

  // ── Scheduled orders ──────────────────────────────────────────────
  // When set, the order is held in PENDING until ~30min before scheduledFor.
  // A delayed BullMQ job releases it to the restaurant at that time.
  @Prop({ type: Date, default: null, index: true })
  scheduledFor!: Date | null

  @Prop({ type: String, default: null })
  scheduledReleaseJobId!: string | null

  // ── Rider earnings settlement ────────────────────────────────────
  // On delivery we credit the rider's `pendingKobo`. The nightly settlement
  // cron moves pending → total after 24h and stamps this field so we don't
  // double-count.
  @Prop({ type: Date, default: null, index: true })
  riderEarningsSettledAt!: Date | null

  @Prop({ required: true, default: 'NG' })
  country!: string

  @Prop({ required: true, default: 'NGN' })
  currency!: string

  @Prop({ type: Date, default: null })
  restaurantClearedAt!: Date | null

  @Prop({ type: Date, default: null })
  systemClearedAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const OrderSchema = SchemaFactory.createForClass(OrderDocument)

OrderSchema.index({ customerId: 1, createdAt: -1 })
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 })
OrderSchema.index({ riderId: 1, status: 1 })
OrderSchema.index({ status: 1, createdAt: -1 }) // admin dashboard
OrderSchema.index({ 'payment.status': 1, 'payment.reference': 1 }) // payment webhook lookup
