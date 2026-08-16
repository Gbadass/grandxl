import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type BannerDocumentType = HydratedDocument<BannerDocument>

// Hero banners shown on the customer mobile home screen + web landing page.
// Inactive + outside the date window are hidden from the public endpoint but
// remain in the admin view for re-activation later.
@Schema({ collection: 'banners', timestamps: true })
export class BannerDocument {
  @Prop({ required: true, trim: true })
  title!: string

  @Prop({ default: '' })
  subtitle!: string

  @Prop({ required: true })
  imageUrl!: string

  // Optional deep link the banner taps into. Can be a `grandxl://...` URL or
  // a relative path; the mobile client decides how to resolve it.
  @Prop({ default: null, type: String })
  linkUrl!: string | null

  @Prop({ default: true })
  isActive!: boolean

  @Prop({ type: Date, required: true })
  startDate!: Date

  @Prop({ type: Date, required: true })
  endDate!: Date

  @Prop({ default: 0 })
  sortOrder!: number
}

export const BannerSchema = SchemaFactory.createForClass(BannerDocument)

BannerSchema.index({ isActive: 1, startDate: 1, endDate: 1, sortOrder: 1 })
