import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

@Schema({ timestamps: true, collection: 'menu_items' })
export class MenuItemDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'RestaurantDocument', required: true })
  restaurantId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'MenuCategoryDocument', required: true })
  categoryId!: Types.ObjectId

  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ default: '' })
  description!: string

  @Prop({ type: String, default: null })
  image!: string | null

  @Prop({ required: true, min: 0 })
  basePrice!: number // kobo

  @Prop({ default: true })
  isAvailable!: boolean

  @Prop({ default: false })
  isPopular!: boolean

  @Prop({ default: 0 })
  sortOrder!: number

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        isRequired: { type: Boolean, default: false },
        options: [
          {
            name: { type: String, required: true },
            priceAdjustment: { type: Number, default: 0 },
          },
        ],
      },
    ],
    default: [],
  })
  variants!: {
    name: string
    isRequired: boolean
    options: { name: string; priceAdjustment: number }[]
  }[]

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        isAvailable: { type: Boolean, default: true },
      },
    ],
    default: [],
  })
  addOns!: { name: string; price: number; isAvailable: boolean }[]

  @Prop({ type: [String], default: [] })
  allergens!: string[]

  @Prop({ type: Number, default: null })
  calories!: number | null

  // Per-item kitchen estimate. Order ETA sums these for accuracy; null falls back to the
  // restaurant default estimatedDeliveryTime.
  @Prop({ type: Number, default: null, min: 0 })
  prepTimeMinutes!: number | null

  // Inventory. null = unlimited. 0 = sold out (auto-flips isAvailable false at decrement).
  @Prop({ type: Number, default: null, min: 0 })
  stockCount!: number | null

  // Triggers low-stock alerts when stockCount falls below this. null = no alerts.
  @Prop({ type: Number, default: null, min: 0 })
  lowStockThreshold!: number | null

  createdAt!: Date
  updatedAt!: Date
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItemDocument)

MenuItemSchema.index({ restaurantId: 1, categoryId: 1, isAvailable: 1 })
MenuItemSchema.index({ restaurantId: 1, isPopular: 1 })

// Full-text search — used by SearchModule (Part 3)
MenuItemSchema.index({ name: 'text', description: 'text' })
