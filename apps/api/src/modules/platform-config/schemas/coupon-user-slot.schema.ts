import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type CouponUserSlotDocumentType = HydratedDocument<CouponUserSlotDocument>

// Per-user reservation counter. One document per (coupon, user) pair. The unique
// compound index below is what makes the atomic `$inc + upsert` in validateCoupon
// race-safe: two concurrent requests both target the same document, so MongoDB
// serialises them and the increment is authoritative — no TOCTOU gap.
@Schema({ timestamps: true, collection: 'coupon_user_slots' })
export class CouponUserSlotDocument {
  @Prop({ type: Types.ObjectId, ref: 'CouponDocument', required: true })
  couponId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

  @Prop({ default: 0, min: 0 })
  usedCount!: number

  createdAt!: Date
  updatedAt!: Date
}

export const CouponUserSlotSchema = SchemaFactory.createForClass(CouponUserSlotDocument)

CouponUserSlotSchema.index({ couponId: 1, userId: 1 }, { unique: true })
