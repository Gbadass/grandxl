import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type PayoutRequestDocumentType = HydratedDocument<PayoutRequestDocument>

export enum PayoutStatus {
  PENDING   = 'pending',   // awaiting admin review
  APPROVED  = 'approved',  // admin OK'd; transfer in progress
  PAID      = 'paid',      // admin marked the transfer complete
  REJECTED  = 'rejected',  // admin declined (reason recorded)
}

@Schema({ collection: 'payout_requests', timestamps: true })
export class PayoutRequestDocument {
  @Prop({ type: Types.ObjectId, ref: 'RiderDocument', required: true, index: true })
  riderId!: Types.ObjectId

  // Mirrored from the user record at request time, so admin sees who's paid even
  // if the user later changes their name.
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

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
