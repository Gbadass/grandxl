import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ReferralStatus = 'pending' | 'rewarded' | 'expired'

@Schema({ timestamps: true, collection: 'referrals' })
export class ReferralDocument extends Document {
  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  referrerId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'UserDocument', required: true })
  refereeId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'OrderDocument', default: null })
  refereeOrderId!: Types.ObjectId | null

  @Prop({ type: String, enum: ['pending', 'rewarded', 'expired'], default: 'pending' })
  status!: ReferralStatus

  // Amount credited to referrer on the referee's first completed order
  @Prop({ type: Number, default: 0 })
  rewardAmountKobo!: number

  // Injected by Mongoose timestamps
  createdAt!: Date
  updatedAt!: Date
}

export const ReferralSchema = SchemaFactory.createForClass(ReferralDocument)

ReferralSchema.index({ referrerId: 1 })
ReferralSchema.index({ refereeId: 1 }, { unique: true }) // one referral record per new user
