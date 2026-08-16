import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type WalletTransactionDocumentType = HydratedDocument<WalletTransactionDocument>

export enum WalletTxnType {
  CREDIT = 'credit',
  DEBIT  = 'debit',
}

export enum WalletTxnReason {
  REFUND        = 'refund',
  PROMO         = 'promo',
  REFERRAL      = 'referral',
  ADMIN_ADJUST  = 'admin_adjust',
  ORDER_PAYMENT = 'order_payment',
  TOP_UP        = 'top_up',
  PAYOUT        = 'payout',
}

// Immutable ledger entry. Each row records balanceBefore/After so we can
// always reconstruct the wallet state from the ledger alone.
@Schema({ collection: 'wallet_transactions', timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class WalletTransactionDocument {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true, index: true })
  userId!: Types.ObjectId

  @Prop({ type: String, enum: WalletTxnType, required: true })
  type!: WalletTxnType

  @Prop({ type: String, enum: WalletTxnReason, required: true })
  reason!: WalletTxnReason

  @Prop({ required: true })
  amount!: number // kobo, always positive — direction is in `type`

  @Prop({ required: true })
  balanceBefore!: number

  @Prop({ required: true })
  balanceAfter!: number

  @Prop()
  description?: string

  // Optional link to whatever triggered this — order, refund request, manual admin action
  @Prop()
  referenceType?: string

  @Prop()
  referenceId?: string

  @Prop({ default: Date.now, index: true })
  createdAt!: Date
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransactionDocument)

WalletTransactionSchema.index({ userId: 1, createdAt: -1 })
