import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type CampaignDocumentType = HydratedDocument<CampaignDocument>

export enum CampaignAudience {
  ALL_CUSTOMERS      = 'all_customers',
  ALL_RIDERS         = 'all_riders',
  ALL_RESTAURANT_OWNERS = 'all_restaurant_owners',
  INACTIVE_30D       = 'inactive_30d',
}

export enum CampaignStatus {
  DRAFT      = 'draft',
  QUEUED     = 'queued',
  SENDING    = 'sending',
  COMPLETED  = 'completed',
  FAILED     = 'failed',
}

@Schema({ collection: 'campaigns', timestamps: true })
export class CampaignDocument {
  @Prop({ required: true, trim: true })
  title!: string

  @Prop({ required: true, trim: true })
  body!: string

  // Optional deep link (grandxl://... or /path) attached to the push payload.
  @Prop({ type: String, default: null })
  linkUrl!: string | null

  @Prop({ type: String, enum: CampaignAudience, required: true })
  audience!: CampaignAudience

  @Prop({ type: String, enum: CampaignStatus, default: CampaignStatus.DRAFT, index: true })
  status!: CampaignStatus

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  createdBy!: Types.ObjectId

  @Prop({ default: 0 })
  targetCount!: number

  @Prop({ default: 0 })
  sentCount!: number

  @Prop({ default: 0 })
  failedCount!: number

  @Prop()
  startedAt?: Date

  @Prop()
  completedAt?: Date

  @Prop()
  failureReason?: string
}

export const CampaignSchema = SchemaFactory.createForClass(CampaignDocument)

CampaignSchema.index({ status: 1, createdAt: -1 })
