import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type RefundRequestDocumentType = HydratedDocument<RefundRequestDocument>

export enum RefundStatus {
  PENDING   = 'pending',
  APPROVED  = 'approved',
  REJECTED  = 'rejected',
  COMPLETED = 'completed', // paystack refund + wallet credit applied
  FAILED    = 'failed',    // paystack rejected — operations must intervene
}

export enum RefundMethod {
  ORIGINAL  = 'original', // Paystack reverses to source card
  WALLET    = 'wallet',   // Credit to user's GrandXL wallet (instant)
}

@Schema({ collection: 'refund_requests', timestamps: true })
export class RefundRequestDocument {
  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', required: true, index: true })
  orderId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true, index: true })
  customerId!: Types.ObjectId

  @Prop({ required: true, min: 1 })
  amountKobo!: number

  @Prop({ required: true })
  reason!: string

  @Prop({ type: String, enum: RefundStatus, default: RefundStatus.PENDING, index: true })
  status!: RefundStatus

  // Decided at approval time — admin picks original-card or wallet credit.
  @Prop({ type: String, enum: RefundMethod })
  method?: RefundMethod

  // Who approved/rejected + when
  @Prop({ type: Types.ObjectId, ref: 'UserDocument' })
  decidedBy?: Types.ObjectId

  @Prop()
  decidedAt?: Date

  @Prop()
  decisionNote?: string

  // Paystack refund reference once issued
  @Prop()
  paystackRefundReference?: string

  // If method is WALLET — the wallet ledger txn id we created
  @Prop()
  walletTransactionId?: string
}

export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequestDocument)

RefundRequestSchema.index({ customerId: 1, createdAt: -1 })
RefundRequestSchema.index({ status: 1, createdAt: -1 })
