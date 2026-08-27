import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type PayoutRequestDocumentType = HydratedDocument<PayoutRequestDocument>

export enum PayoutStatus {
  PENDING   = 'pending',   // awaiting admin review
  APPROVED  = 'approved',  // admin OK'd; transfer in progress
  PAID      = 'paid',      // admin marked the transfer complete
  REJECTED  = 'rejected',  // admin declined (reason recorded)
}

// Sprint 12 (S12-6): payouts are entity-agnostic. Riders were the original entity
// type; restaurants were added when the audit surfaced that owners had no way to
// pull their earnings. Adding a new type in the future = one string here + a
// service branch, no schema migration.
export type PayoutEntityType = 'rider' | 'restaurant'

@Schema({ collection: 'payout_requests', timestamps: true })
export class PayoutRequestDocument {
  // The party being paid. Legacy documents predate this field — Mongoose returns
  // the default `'rider'` for missing values on read, matching the original behavior.
  @Prop({ type: String, enum: ['rider', 'restaurant'], default: 'rider', index: true })
  entityType!: PayoutEntityType

  // Rider._id for rider payouts, Restaurant._id for restaurant payouts. For legacy
  // documents (all rider-typed) this equals riderId — set at read time via a fallback
  // in the service if missing.
  @Prop({ type: Types.ObjectId, index: true })
  entityId?: Types.ObjectId

  // Legacy — kept for back-compat with rider-side queries and to avoid touching the
  // existing rider payout list endpoints. For rider requests both riderId and
  // entityId are populated with the same value; for restaurant requests, only entityId.
  @Prop({ type: Types.ObjectId, ref: 'RiderDocument', index: true })
  riderId?: Types.ObjectId

  // Mirrored from the user record at request time, so admin sees who requested even
  // if the user later changes their name. Optional now because restaurant requests
  // don't have a single acting user (the owner may switch), but we still populate
  // it for rider requests to keep back-compat.
  @Prop({ type: Types.ObjectId, ref: 'UserDocument' })
  userId?: Types.ObjectId

  @Prop({ required: true, min: 1 })
  amountKobo!: number

  // Snapshot of bank details at request time — admin pays out against these even
  // if the rider later edits their bank account.
  @Prop({ required: true })
  bankName!: string

  @Prop({ required: true })
  accountNumber!: string

  @Prop({ required: true })
  accountName!: string

  // Stored at request time so admin can create a Paystack recipient even if rider later changes bank details.
  @Prop()
  bankCode?: string

  @Prop({ type: String, enum: PayoutStatus, default: PayoutStatus.PENDING, index: true })
  status!: PayoutStatus

  @Prop({ type: Types.ObjectId, ref: 'UserDocument' })
  decidedBy?: Types.ObjectId

  @Prop()
  decidedAt?: Date

  @Prop()
  decisionNote?: string

  // Paystack transfer reference (e.g. TRF_xxx) — set when Paystack transfer is initiated.
  @Prop()
  transferReference?: string

  // Paystack transfer code (e.g. TRF_abc123) returned by Paystack on initiation.
  @Prop()
  paystackTransferCode?: string

  @Prop()
  paidAt?: Date
}

export const PayoutRequestSchema = SchemaFactory.createForClass(PayoutRequestDocument)

PayoutRequestSchema.index({ riderId: 1, createdAt: -1 })
PayoutRequestSchema.index({ status: 1, createdAt: -1 })
PayoutRequestSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
