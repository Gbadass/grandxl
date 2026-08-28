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

  // Snapshotted at creation so riders see the restaurant name without a separate fetch.
  @Prop({ type: String, default: '' })
  restaurantName!: string

  // Snapshotted at creation — used by TrackingGateway to notify the restaurant
  // owner when the rider is nearby, without a separate restaurant collection lookup.
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  restaurantOwnerId!: Types.ObjectId

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

  @Prop({ type: String, default: null })
  deliveryInstructions!: string | null

  @Prop({ type: Number, default: null })
  estimatedTime!: number | null // minutes

  @Prop({ type: Date, default: null })
  actualDeliveryAt!: Date | null

  // ── Cash-on-delivery ──────────────────────────────────────────────
  // Stamped when the rider confirms they collected cash from the customer.
  // Required for DELIVERED transition on CASH orders — without it, the rider
  // could mark delivered without ever asking for money. If cash was not fully
  // collected, rider opens a dispute instead (existing dispute flow).
  @Prop({ type: Date, default: null })
  cashCollectedAt!: Date | null

  // ── Delivery proof ────────────────────────────────────────────────
  // Cloudinary URL of the rider's proof-of-delivery photo. Required by the
  // server for COD orders (fraud deterrent); optional but encouraged for card
  // orders. Admin views this on the order detail to resolve disputes.
  @Prop({ type: String, default: null })
  deliveryProofUrl!: string | null

  // Customer rating submitted after delivery — 1–5 stars
  @Prop({ type: Number, default: null, min: 1, max: 5 })
  rating!: number | null

  @Prop({ type: String, default: null, maxlength: 500 })
  reviewText!: string | null

  @Prop({ type: Date, default: null })
  ratedAt!: Date | null

  @Prop({ type: String, default: null })
  cancelReason!: string | null

  // Canonical code for the cancellation. Enables analytics + i18n on the
  // customer side. See `CancelReasonCode` in packages/types.
  @Prop({ type: String, default: null, index: true })
  cancelReasonCode!: string | null

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

  // Sprint 12 (S12-6): mirror of rider settlement, for restaurant earnings.
  // Same 24h hold + nightly settle model. The two fields advance independently
  // — an order can be rider-settled but not yet restaurant-settled if the two
  // settlement runs happen at different times (though today they're one job).
  @Prop({ type: Date, default: null, index: true })
  restaurantEarningsSettledAt!: Date | null

  // Sprint 12 (S12-11): straight-line distance restaurant → delivery address,
  // computed once at order create. Null on old rows and on edge cases where
  // one side is missing coords. Restaurant portal + rider PWA render this so
  // both sides know how far the trip is before accepting.
  @Prop({ type: Number, default: null })
  deliveryDistanceKm!: number | null

  // Sprint 12 (S12-11): true when the customer explicitly acknowledged that
  // this address is outside the restaurant's normal `deliveryRadius`. Shown as
  // a "Far delivery" chip in the restaurant portal and rider PWA so nobody is
  // surprised by a longer-than-usual trip.
  @Prop({ type: Boolean, default: false, index: true })
  isFarDelivery!: boolean

  @Prop({ required: true, default: 'NG' })
  country!: string

  @Prop({ required: true, default: 'NGN' })
  currency!: string

  // Rider userIds who explicitly declined this broadcast — excluded from re-broadcasts
  @Prop({ type: [{ type: Types.ObjectId, ref: 'UserDocument' }], default: [] })
  declinedBy!: Types.ObjectId[]

  // ── Dispatch observability ────────────────────────────────────────
  @Prop({ type: Date, default: null })
  firstDispatchAt!: Date | null  // when the first broadcast round fired

  @Prop({ type: Date, default: null })
  riderAssignedAt!: Date | null  // when riderId was first set

  @Prop({ type: Number, default: 0 })
  dispatchRounds!: number        // how many broadcast rounds ran

  @Prop({ type: Number, default: 0 })
  dispatchBroadcastCount!: number // total riders broadcast to across all rounds

  @Prop({ type: Date, default: null })
  restaurantClearedAt!: Date | null

  @Prop({ type: Date, default: null })
  systemClearedAt!: Date | null

  // ── Sprint 4.5: engagement + wait time observability ──────────────
  // Stamped ONLY when a restaurant owner explicitly hits Accept in the modal.
  // Not set when the payment webhook auto-confirms — that's the whole point;
  // the two paths need to be distinguishable to compute engagement rate.
  @Prop({ type: Date, default: null })
  restaurantConfirmedAt!: Date | null

  // Stamped when restaurant marks READY. Some engaged restaurants skip the Accept
  // step (rider grabbed the order first) but still mark READY — both count as engaged.
  @Prop({ type: Date, default: null })
  restaurantReadyAt!: Date | null

  // ── S-URGENT (Nigerian ack flow): dispatch gate ──────────────────
  // Broader than restaurantConfirmedAt — any restaurant-driven state transition
  // (Accept, Mark Ready, Reject) stamps this. Used as the "restaurant has
  // engaged with this order" gate for two things:
  //   1. assignRider's auto-advance CONFIRMED → PREPARING only fires if set.
  //      Otherwise a rider-accept keeps the order at CONFIRMED so the customer
  //      tracker doesn't claim "preparing" when kitchen doesn't know.
  //   2. The 90s dispatch-escalation timer sets dispatchedWithoutRestaurantAck
  //      when it fires without this being set.
  // Distinct from restaurantConfirmedAt so the engagement analytics (Sprint 4.5)
  // isn't polluted — that's still "restaurant clicked Accept" specifically.
  @Prop({ type: Date, default: null, index: true })
  restaurantAckedAt!: Date | null

  // True when the T+90s escalation timer had to fire dispatch because the
  // restaurant hadn't engaged. Stays true even after the restaurant later
  // interacts — a permanent "rider drove this order" flag for ops to spot
  // repeatedly-absent restaurants.
  @Prop({ type: Boolean, default: false, index: true })
  dispatchedWithoutRestaurantAck!: boolean

  // Stamped when status transitions to PICKED_UP. Used with riderAssignedAt to
  // compute rider dwell time at the restaurant.
  @Prop({ type: Date, default: null })
  pickedUpAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const OrderSchema = SchemaFactory.createForClass(OrderDocument)

OrderSchema.index({ customerId: 1, createdAt: -1 })
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 })
OrderSchema.index({ riderId: 1, status: 1 })
OrderSchema.index({ status: 1, createdAt: -1 }) // admin dashboard
OrderSchema.index({ 'payment.status': 1, 'payment.reference': 1 }) // payment webhook lookup
// Rider earnings / wait-time analytics — queried by (riderId, riderAssignedAt desc)
OrderSchema.index({ riderId: 1, riderAssignedAt: -1 })
