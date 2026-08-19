import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type CouponUsageDocumentType = HydratedDocument<CouponUsageDocument>

@Schema({ timestamps: true, collection: 'coupon_usages' })
export class CouponUsageDocument {
  @Prop({ type: Types.ObjectId, ref: 'CouponDocument', required: true })
  couponId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', required: true })
  orderId!: Types.ObjectId

  createdAt!: Date
  updatedAt!: Date
}

export const CouponUsageSchema = SchemaFactory.createForClass(CouponUsageDocument)

// Per-user lookup for limit enforcement
CouponUsageSchema.index({ couponId: 1, userId: 1 })
// Per-order lookup so we can roll back usage on order cancellation
CouponUsageSchema.index({ orderId: 1 })
