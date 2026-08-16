import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true, collection: 'food_categories' })
export class FoodCategoryDocument extends Document {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string

  @Prop({ type: String, default: null })
  image!: string | null

  @Prop({ default: 0 })
  sortOrder!: number

  @Prop({ default: true })
  isActive!: boolean

  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', default: null })
  createdBy!: Types.ObjectId | null

  createdAt!: Date
  updatedAt!: Date
}

export const FoodCategorySchema = SchemaFactory.createForClass(FoodCategoryDocument)

FoodCategorySchema.index({ isActive: 1, sortOrder: 1 })
