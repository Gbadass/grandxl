import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type DeliveryZoneDocumentType = HydratedDocument<DeliveryZoneDocument>

// A polygon defining where we deliver. Mongo `2dsphere` on `polygon` lets us
// use $geoIntersects to check whether a delivery address falls inside.
@Schema({ collection: 'delivery_zones', timestamps: true })
export class DeliveryZoneDocument {
  @Prop({ required: true, trim: true })
  name!: string

  @Prop({ default: '' })
  city!: string

  // GeoJSON Polygon stored as Object — Mongoose has trouble validating the
  // deeply-nested numeric array otherwise. Mongo still indexes this correctly
  // as long as we set the 2dsphere index below.
  @Prop({ type: Object, required: true })
  polygon!: { type: 'Polygon'; coordinates: number[][][] }

  // Multiplier on the restaurant's `deliveryFeeFixed`. 1.0 = no change.
  // Larger for far zones, smaller for promo zones.
  @Prop({ required: true, default: 1.0, min: 0 })
  deliveryFeeMultiplier!: number

  @Prop({ default: true })
  isActive!: boolean
}

export const DeliveryZoneSchema = SchemaFactory.createForClass(DeliveryZoneDocument)

DeliveryZoneSchema.index({ polygon: '2dsphere' })
DeliveryZoneSchema.index({ isActive: 1 })
