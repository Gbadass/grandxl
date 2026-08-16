import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'
import { PaymentMethod, PaymentStatus } from '@grandxl/types'

export type TransactionType = 'order_payment' | 'refund' | 'wallet_topup' | 'wallet_payout'

@Schema({ timestamps: true, collection: 'transactions' })
export class TransactionDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  userId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', default: null })
  orderId!: Types.ObjectId | null

  @Prop({
    type: String,
    enum: ['order_payment', 'refund', 'wallet_topup', 'wallet_payout'] as TransactionType[],
    required: true,
  })
  type!: TransactionType

  @Prop({ required: true, enum: Object.values(PaymentMethod) })
  method!: PaymentMethod

  @Prop({ required: true, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING })
  status!: PaymentStatus

  @Prop({ required: true, min: 0 })
  amount!: number // kobo

  @Prop({ type: String, default: null })
  reference!: string | null // Paystack reference

  @Prop({ type: Object, default: null })
  paystackData!: Record<string, unknown> | null // raw webhook payload for audit

  @Prop({ default: 'NG' })
  country!: string

  @Prop({ default: 'NGN' })
  currency!: string

  createdAt!: Date
  updatedAt!: Date
}

export const TransactionSchema = SchemaFactory.createForClass(TransactionDocument)

TransactionSchema.index({ userId: 1, createdAt: -1 })
TransactionSchema.index({ orderId: 1 })
TransactionSchema.index({ reference: 1 }, { unique: true, sparse: true })
TransactionSchema.index({ status: 1, createdAt: -1 })
