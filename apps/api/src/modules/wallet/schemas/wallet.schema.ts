import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type WalletDocumentType = HydratedDocument<WalletDocument>

// One per user. Balance is in kobo (always integer).
// Mutated only via WalletService.credit/debit inside a transaction with the matching ledger entry.
@Schema({ collection: 'wallets', timestamps: true })
export class WalletDocument {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true, unique: true, index: true })
  userId!: Types.ObjectId

  @Prop({ required: true, default: 0 })
  balance!: number // kobo

  // Currency lives at the user level (country) — we mirror it for fast reads.
  @Prop({ default: 'NGN' })
  currency!: string
}

export const WalletSchema = SchemaFactory.createForClass(WalletDocument)
