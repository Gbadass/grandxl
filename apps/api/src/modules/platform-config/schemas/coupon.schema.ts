import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type CouponType = 'percentage' | 'fixed_amount' | 'free_delivery'

@Schema({ timestamps: true, collection: 'coupons' })
export class CouponDocument extends Document {
  @Prop({ required: true, uppercase: true, trim: true })
  code!: string

  @Prop({ required: true, enum: ['percentage', 'fixed_amount', 'free_delivery'] as CouponType[] })
  type!: CouponType

  @Prop({ required: true, min: 0 })
  value!: number // % for percentage, kobo for fixed_amount; ignored for free_delivery

  @Prop({ default: 0, min: 0 })
  minOrderAmount!: number // kobo

  @Prop({ default: 0, min: 0 })
  maxDiscount!: number // kobo — 0 means no cap

  @Prop({ default: 0 })
  usageLimit!: number // 0 = unlimited

  @Prop({ default: 0 })
  usageCount!: number

  @Prop({ default: 1 })
  perUserLimit!: number

  @Prop({ type: [{ type: Types.ObjectId, ref: 'RestaurantDocument' }], default: [] })
  applicableRestaurants!: Types.ObjectId[] // empty = all restaurants

  @Prop({ required: true })
  startDate!: Date

  @Prop({ required: true })
  endDate!: Date

  @Prop({ default: true })
  isActive!: boolean

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  createdBy!: Types.ObjectId

  createdAt!: Date
  updatedAt!: Date
}

export const CouponSchema = SchemaFactory.createForClass(CouponDocument)

CouponSchema.index({ code: 1 }, { unique: true })
CouponSchema.index({ isActive: 1, startDate: 1, endDate: 1 })
