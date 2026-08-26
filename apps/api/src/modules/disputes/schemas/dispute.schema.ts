import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export enum DisputeType {
  WRONG_ORDER    = 'wrong_order',
  MISSING_ITEMS  = 'missing_items',
  LATE_DELIVERY  = 'late_delivery',
  FOOD_QUALITY   = 'food_quality',
  RIDER_CONDUCT  = 'rider_conduct',
  PAYMENT_ISSUE  = 'payment_issue',
  OTHER          = 'other',
}

export enum DisputeStatus {
  OPEN         = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED     = 'resolved',
  CLOSED       = 'closed',
}

@Schema({ timestamps: true, collection: 'disputes' })
export class DisputeDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', required: true })
  orderId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  customerId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', required: true })
  restaurantId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'RiderDocument', default: null })
  riderId!: Types.ObjectId | null

  @Prop({ required: true, enum: Object.values(DisputeType) })
  type!: DisputeType

  @Prop({ required: true, maxlength: 1000 })
  description!: string

  @Prop({
    required: true,
    enum: Object.values(DisputeStatus),
    default: DisputeStatus.OPEN,
  })
  status!: DisputeStatus

  @Prop({ type: String, default: null })
  resolution!: string | null

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', default: null })
  resolvedBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const DisputeSchema = SchemaFactory.createForClass(DisputeDocument)

DisputeSchema.index({ customerId: 1, createdAt: -1 })
DisputeSchema.index({ status: 1, createdAt: -1 })
// Fast "any disputes on this order?" lookup for admin order detail
DisputeSchema.index({ orderId: 1 })
// Customer "my disputes filtered by status" — most common tab view
DisputeSchema.index({ customerId: 1, status: 1, createdAt: -1 })
