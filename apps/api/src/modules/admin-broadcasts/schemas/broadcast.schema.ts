import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { UserRole } from '@grandxl/types'

export type BroadcastDocumentType = HydratedDocument<BroadcastDocument>

// Sprint 13 (S13-8): history record for each admin-initiated broadcast. Kept
// lean — recipients are not stored per-user (that would blow up on a 10k-user
// fan-out), just the count. Per-user delivery is in the notifications
// collection where each recipient gets a normal notification row.
@Schema({ collection: 'broadcasts', timestamps: true })
export class BroadcastDocument {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  actorId!: Types.ObjectId

  @Prop({ type: [String], enum: Object.values(UserRole), required: true })
  audiences!: UserRole[]

  @Prop({ required: true, maxlength: 120 })
  title!: string

  @Prop({ required: true, maxlength: 1000 })
  body!: string

  // Optional deep-link URL — customer-web / admin can navigate on click.
  @Prop({ type: String, default: null })
  actionUrl!: string | null

  @Prop({ required: true, default: 0 })
  recipientCount!: number

  // Delivered = notification.send() call didn't throw. A best-effort count;
  // the notifications collection is the authoritative per-recipient record.
  @Prop({ required: true, default: 0 })
  deliveredCount!: number

  @Prop({ required: true })
  sentAt!: Date

  createdAt!: Date
  updatedAt!: Date
}

export const BroadcastSchema = SchemaFactory.createForClass(BroadcastDocument)
BroadcastSchema.index({ sentAt: -1 })
