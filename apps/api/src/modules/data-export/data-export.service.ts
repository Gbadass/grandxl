import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { UserDocument } from '../users/schemas/user.schema'
import { OrderDocument } from '../orders/schemas/order.schema'
import { RefundRequestDocument } from '../refunds/schemas/refund-request.schema'
import { WalletTransactionDocument } from '../wallet/schemas/wallet-transaction.schema'
import { NotificationDocument } from '../notifications/schemas/notification.schema'
import { RiderDocument } from '../riders/schemas/rider.schema'
import { PayoutRequestDocument } from '../payouts/schemas/payout-request.schema'
import { AuditLogDocument } from '../audit/schemas/audit-log.schema'

// NDPR / GDPR right-of-access implementation. Gathers every collection where we
// might store personal data keyed to the user and returns a single JSON blob.
// Only anonymises `passwordHash` — everything else is fair game for the export.
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name)

  constructor(
    @InjectModel(UserDocument.name)              private readonly userModel:          Model<UserDocument>,
    @InjectModel('OrderDocument')                private readonly orderModel:         Model<OrderDocument>,
    @InjectModel('RefundRequestDocument')        private readonly refundModel:        Model<RefundRequestDocument>,
    @InjectModel('WalletTransactionDocument')    private readonly walletTxnModel:     Model<WalletTransactionDocument>,
    @InjectModel(NotificationDocument.name)      private readonly notificationModel:  Model<NotificationDocument>,
    @InjectModel(RiderDocument.name)             private readonly riderModel:         Model<RiderDocument>,
    @InjectModel('PayoutRequestDocument')        private readonly payoutModel:        Model<PayoutRequestDocument>,
    @InjectModel('AuditLogDocument')             private readonly auditModel:         Model<AuditLogDocument>,
  ) {}

  async exportForUser(userId: string): Promise<Record<string, unknown>> {
    const uid = new Types.ObjectId(userId)

    // Parallel across collections — each is independent.
    const [
      user,
      orders,
      refunds,
      walletTxns,
      notifications,
      rider,
      auditLogs,
    ] = await Promise.all([
      this.userModel.findById(uid).lean(),
      this.orderModel.find({ customerId: uid }).lean(),
      this.refundModel.find({ customerId: uid }).lean(),
      this.walletTxnModel.find({ userId: uid }).sort({ createdAt: -1 }).lean(),
      this.notificationModel.find({ userId: uid }).sort({ createdAt: -1 }).limit(500).lean(),
      this.riderModel.findOne({ userId: uid }).lean(),
      this.auditModel.find({ actorId: uid }).sort({ createdAt: -1 }).limit(200).lean(),
    ])

    // If they're a rider, include payout requests too.
    const payouts = rider
      ? await this.payoutModel.find({ riderId: rider._id }).sort({ createdAt: -1 }).lean()
      : []

    // Strip sensitive internal fields — passwordHash is the big one; everything
    // else is legitimately the user's data.
    if (user && 'passwordHash' in user) {
      delete (user as { passwordHash?: string }).passwordHash
    }

    return {
      exportedAt: new Date().toISOString(),
      user,
      addresses: user?.addresses ?? [],
      orders,
      refunds,
      wallet: {
        transactions: walletTxns,
      },
      notifications,
      rider,
      payouts,
      auditLog: auditLogs,
      // Meta: what we didn't include and why, so audits can verify completeness.
      _meta: {
        notes: [
          'passwordHash omitted — the plaintext is unrecoverable by design.',
          'notifications capped at 500 most recent.',
          'auditLog capped at 200 most recent actions where user is the actor.',
        ],
      },
    }
  }
}
