import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { UsersService } from '../users/users.service'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { NotificationsService } from '../notifications/notifications.service'
import { NotificationType, PaymentStatus } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'

// Sprint 13 (S13-5): admin-initiated wallet credits. Distinct from customer-
// initiated refunds (which live in the disputes/refunds queue). These are
// live-ops actions — admin decides, admin acts, audit trail is the record.
@Injectable()
export class AdminSupportService {
  private readonly logger = new Logger(AdminSupportService.name)

  constructor(
    @InjectModel(OrderDocument.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Force refund tied to an order ────────────────────────────────

  async forceRefund(args: {
    orderId: string
    amountKobo?: number
    reason:  string
  }): Promise<{ orderId: string; refundedKobo: number; balanceAfter: number }> {
    if (!Types.ObjectId.isValid(args.orderId)) throw new BadRequestException('Invalid orderId')

    const order = await this.orderModel.findById(args.orderId).lean() as unknown as {
      _id: Types.ObjectId
      orderNumber: string
      customerId: Types.ObjectId
      pricing: { total: number }
      payment: { status: string }
      currency: string
    } | null
    if (!order) throw new NotFoundException('Order not found')

    // Default to the full order total. Amount over the order total is refused —
    // if admin genuinely wants to overpay, use emergencyCredit for the excess.
    const requested = args.amountKobo ?? order.pricing.total
    if (requested < 1) throw new BadRequestException('Refund amount must be at least ₦0.01')
    if (requested > order.pricing.total) {
      throw new BadRequestException(
        `Refund exceeds order total (${formatMoney(order.pricing.total, order.currency)}). Use Emergency credit for the excess.`,
      )
    }

    // Reject double-refund. If the order was already fully refunded (or the
    // customer requested a refund and it was approved) the payment status is
    // REFUNDED already; force-refund on top would double-credit.
    if (order.payment?.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('This order was already refunded')
    }

    const { balance } = await this.walletService.credit({
      userId:        order.customerId.toString(),
      amount:        requested,
      reason:        WalletTxnReason.REFUND,
      description:   `Force refund on ${order.orderNumber} — ${args.reason}`,
      referenceType: 'order_force_refund',
      referenceId:   order._id.toString(),
    })

    // Update the order's payment status only on a full refund. Partial refunds
    // keep the payment as COMPLETED because the customer still received part
    // of the value — matches Paystack/Stripe conventions.
    if (requested >= order.pricing.total) {
      await this.orderModel.updateOne(
        { _id: order._id },
        { $set: { 'payment.status': PaymentStatus.REFUNDED } },
      )
    }

    // Push notification to the customer so they see the credit immediately.
    // Fire-and-forget — the money is already in their wallet.
    void this.notifications.send(
      order.customerId.toString(),
      NotificationType.SYSTEM,
      'Refund credited',
      `${formatMoney(requested, order.currency)} credited to your wallet for order ${order.orderNumber}. Reason: ${args.reason}`,
      { orderId: order._id.toString(), refundedKobo: requested, reason: args.reason },
    ).catch(() => undefined)

    this.logger.log(`Force refund: ${formatMoney(requested, order.currency)} → ${order.customerId} for ${order.orderNumber}`)

    return { orderId: order._id.toString(), refundedKobo: requested, balanceAfter: balance }
  }

  // ── Emergency service credit (untied to any order) ───────────────

  async emergencyCredit(args: {
    userId:     string
    amountKobo: number
    reason:     string
  }): Promise<{ userId: string; creditedKobo: number; balanceAfter: number }> {
    if (!Types.ObjectId.isValid(args.userId)) throw new BadRequestException('Invalid userId')
    if (args.amountKobo < 1) throw new BadRequestException('Credit must be at least ₦0.01')

    const user = await this.usersService.findById(args.userId).catch(() => null)
    if (!user) throw new NotFoundException('User not found')

    const { balance } = await this.walletService.credit({
      userId:        args.userId,
      amount:        args.amountKobo,
      reason:        WalletTxnReason.ADMIN_ADJUST,
      description:   `Goodwill credit — ${args.reason}`,
      referenceType: 'admin_emergency_credit',
      referenceId:   args.userId,
    })

    void this.notifications.send(
      args.userId,
      NotificationType.SYSTEM,
      'Wallet credit received',
      `${formatMoney(args.amountKobo, 'NGN')} has been added to your GrandXL wallet. ${args.reason}`,
      { amountKobo: args.amountKobo, reason: args.reason },
    ).catch(() => undefined)

    this.logger.log(`Emergency credit: ${formatMoney(args.amountKobo, 'NGN')} → ${args.userId}`)

    return { userId: args.userId, creditedKobo: args.amountKobo, balanceAfter: balance }
  }
}
