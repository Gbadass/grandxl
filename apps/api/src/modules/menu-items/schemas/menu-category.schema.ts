import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true, collection: 'menu_categories' })
export class MenuCategoryDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', required: true })
  restaurantId!: Types.ObjectId

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ type: String, default: null })
  description!: string | null

  @Prop({ default: 0 })
  sortOrder!: number

  @Prop({ default: true })
  isActive!: boolean

  createdAt!: Date
  updatedAt!: Date
}

export const MenuCategorySchema = SchemaFactory.createForClass(MenuCategoryDocument)

MenuCategorySchema.index({ restaurantId: 1, sortOrder: 1 })
