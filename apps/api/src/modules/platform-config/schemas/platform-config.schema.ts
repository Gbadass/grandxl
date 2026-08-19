import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

// Singleton document — always exactly one record, queried without a filter
@Schema({ timestamps: true, collection: 'platform_config' })
export class PlatformConfigDocument extends Document {
  @Prop({
    type: [{ maxKm: Number, feeKobo: Number }],
    default: [
      { maxKm: 3, feeKobo: 50_000 },   // ₦500 up to 3 km
      { maxKm: 7, feeKobo: 100_000 },  // ₦1,000 up to 7 km
      { maxKm: 15, feeKobo: 200_000 }, // ₦2,000 up to 15 km
    ],
  })
  deliveryTiers!: { maxKm: number; feeKobo: number }[]

  @Prop({ default: 15 })
  platformCommissionPercent!: number // % of order subtotal kept by GrandXL

  @Prop({ default: 5 }) // customer-facing service fee %
  serviceFeePercent!: number

  @Prop({ default: 150_000 }) // ₦1,500 per master prompt spec
  serviceFeeCapKobo!: number

  @Prop({ default: 50_000 }) // ₦500
  minRiderEarningKobo!: number

  @Prop({
    type: {
      instamart: { type: Boolean, default: false },
      dineout:   { type: Boolean, default: false },
      drinks:    { type: Boolean, default: false },
    },
    default: () => ({ instamart: false, dineout: false, drinks: false }),
  })
  enabledServices!: { instamart: boolean; dineout: boolean; drinks: boolean }

  createdAt!: Date
  updatedAt!: Date
}

export const PlatformConfigSchema = SchemaFactory.createForClass(PlatformConfigDocument)
