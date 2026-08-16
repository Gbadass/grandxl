import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { UserDocument } from '../users/schemas/user.schema'
import { TransactionDocument } from '../payments/schemas/transaction.schema'
import { RefundRequestDocument } from '../refunds/schemas/refund-request.schema'
import { PaymentStatus } from '@grandxl/types'

interface RiskFlagInput {
  code:   string
  reason: string
}

// Fires on hooks (post-payment failure, post-refund request) to re-evaluate a
// user's risk posture. Uses simple rules; nothing ML — deliberately readable.
@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name)

  constructor(
    @InjectModel('UserDocument')            private readonly userModel:   Model<UserDocument>,
    @InjectModel('TransactionDocument')     private readonly txnModel:    Model<TransactionDocument>,
    @InjectModel('RefundRequestDocument')   private readonly refundModel: Model<RefundRequestDocument>,
  ) {}

  // Idempotent — dedupes on `code` so repeated evaluations don't append the same flag.
  async addFlag(userId: string, flag: RiskFlagInput): Promise<void> {
    const uid = new Types.ObjectId(userId)
    await this.userModel.updateOne(
      { _id: uid, 'riskFlags.code': { $ne: flag.code } },
      { $push: { riskFlags: { ...flag, createdAt: new Date() } } },
    )
  }

  async clearFlag(userId: string, code: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $pull: { riskFlags: { code } } },
    )
  }

  async clearAllFlags(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { riskFlags: [] } },
    )
  }

  // ── Rule evaluators ────────────────────────────────────────────────

  // 3+ failed Paystack charges in 24h → likely stolen card testing.
  async evaluatePaymentFailures(userId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const count = await this.txnModel.countDocuments({
      userId: new Types.ObjectId(userId),
      type:   'order_payment',
      status: PaymentStatus.FAILED,
      createdAt: { $gte: since },
    })
    if (count >= 3) {
      await this.addFlag(userId, {
        code:   'payment_failures_24h',
        reason: `${count} failed payments in the last 24 hours`,
      })
    }
  }

  // 2+ refund requests in 7d → repeat disputer, potentially fraudulent.
  async evaluateRefundVelocity(userId: string): Promise<void> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const count = await this.refundModel.countDocuments({
      customerId: new Types.ObjectId(userId),
      createdAt:  { $gte: since },
    })
    if (count >= 2) {
      await this.addFlag(userId, {
        code:   'refund_velocity_7d',
        reason: `${count} refund requests in the last 7 days`,
      })
    }
  }
}
