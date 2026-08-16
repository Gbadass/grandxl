import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type AuditLogDocumentType = HydratedDocument<AuditLogDocument>

// Immutable record of a privileged action. Written once, never updated.
// Read by admin "activity" view + retained for compliance / dispute resolution.
@Schema({ collection: 'audit_logs', timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class AuditLogDocument {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true, index: true })
  actorId!: Types.ObjectId

  @Prop()
  actorEmail?: string

  // e.g. 'restaurant.approve', 'order.refund', 'rider.suspend'
  @Prop({ required: true, index: true })
  action!: string

  // The thing the action was performed on
  @Prop({ required: true })
  targetType!: string

  @Prop()
  targetId?: string

  // Snapshot of the request — never PII like passwords
  @Prop({ type: Object })
  metadata?: Record<string, unknown>

  @Prop()
  ipAddress?: string

  @Prop()
  userAgent?: string

  @Prop({ default: Date.now, index: true })
  createdAt!: Date
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLogDocument)

// Compound index for the "show me everything actor X did this week" query
AuditLogSchema.index({ actorId: 1, createdAt: -1 })
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })
