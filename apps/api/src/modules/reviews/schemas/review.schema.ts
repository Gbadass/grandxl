import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true, collection: 'reviews' })
export class ReviewDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  customerId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', required: true })
  restaurantId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', required: true })
  orderId!: Types.ObjectId // one review per order — unique index enforces this

  @Prop({ required: true, min: 1, max: 5 })
  restaurantRating!: number

  @Prop({ type: Number, default: null, min: 1, max: 5 })
  riderRating!: number | null

  @Prop({ type: Number, default: null, min: 1, max: 5 })
  foodRating!: number | null

  @Prop({ type: String, default: null, maxlength: 500 })
  comment!: string | null

  @Prop({ default: true })
  isVisible!: boolean

  @Prop({ default: false })
  isFlagged!: boolean

  @Prop({ type: String, default: null, maxlength: 200 })
  flagReason!: string | null

  createdAt!: Date
  updatedAt!: Date
}

export const ReviewSchema = SchemaFactory.createForClass(ReviewDocument)

ReviewSchema.index({ restaurantId: 1, isVisible: 1, createdAt: -1 })
ReviewSchema.index({ customerId: 1, createdAt: -1 })
ReviewSchema.index({ orderId: 1 }, { unique: true })
