import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { DisputeDocument } from '../disputes/schemas/dispute.schema'
import { RefundRequestDocument } from '../refunds/schemas/refund-request.schema'
import { UserDocument } from '../users/schemas/user.schema'
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
    @InjectModel(DisputeDocument.name)
    private readonly disputeModel: Model<DisputeDocument>,
    @InjectModel(RefundRequestDocument.name)
    private readonly refundModel: Model<RefundRequestDocument>,
    @InjectModel(UserDocument.name)
    private readonly userModel: Model<UserDocument>,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── S13-14: customer lookup, overview, contact ──────────────────────

  // Escape user input for use in a case-insensitive regex — same pattern
  // as UsersService.listUsers so search behavior is consistent.
  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Search users by phone, email, or first/last name. `q` also matches order
  // shortIds; if a matching order is found, its customer is included in the
  // top of the result set so support agents can jump from an order number to
  // the customer context in one query.
  async lookupCustomers(q: string, limit = 10): Promise<Array<{
    _id: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
    isActive: boolean
    matchedVia?: 'order'
  }>> {
    const query = q.trim()
    if (query.length < 2) return []

    const escaped = this.escapeRegex(query)
    const re = new RegExp(escaped, 'i')

    // Look up user directly first.
    const users = await this.userModel
      .find({
        deletedAt: null,
        $or: [
          { firstName: re },
          { lastName:  re },
          { email:     re },
          { phone:     re },
        ],
      })
      .select('firstName lastName phone email isActive')
      .limit(limit)
      .lean() as unknown as Array<{
        _id: Types.ObjectId
        firstName: string
        lastName: string
        phone: string | null
        email: string | null
        isActive: boolean
      }>

    type ResultRow = {
      _id: string
      firstName: string
      lastName: string
      phone: string | null
      email: string | null
      isActive: boolean
      matchedVia?: 'order'
    }
    const results: ResultRow[] = users.map((u) => ({
      _id:       u._id.toString(),
      firstName: u.firstName,
      lastName:  u.lastName,
      phone:     u.phone,
      email:     u.email,
      isActive:  u.isActive,
    }))

    // If the query looks like it could be an order shortId (alphanumeric,
    // 6+ chars), try that too. Order → customerId → user lookup. Dedupes
    // against the user results already in `results`.
    if (/^[A-Za-z0-9-]{4,}$/.test(query)) {
      const order = await this.orderModel
        .findOne({ orderNumber: new RegExp(`^${escaped}`, 'i') })
        .select('customerId orderNumber')
        .lean() as unknown as { customerId: Types.ObjectId } | null
      if (order && !results.some((r) => r._id === order.customerId.toString())) {
        const orderUser = await this.userModel
          .findById(order.customerId)
          .select('firstName lastName phone email isActive')
          .lean() as unknown as {
            _id: Types.ObjectId
            firstName: string
            lastName: string
            phone: string | null
            email: string | null
            isActive: boolean
          } | null
        if (orderUser) {
          results.unshift({
            _id:        orderUser._id.toString(),
            firstName:  orderUser.firstName,
            lastName:   orderUser.lastName,
            phone:      orderUser.phone,
            email:      orderUser.email,
            isActive:   orderUser.isActive,
            matchedVia: 'order',
          })
        }
      }
    }

    return results.slice(0, limit)
  }

  // Everything a support agent needs about a customer in one round-trip.
  // Wallet balance, last 5 orders (with status + total), last 5 disputes,
  // last 5 refund requests. Deliberately compact — the individual sections
  // link to their existing dedicated pages for deep dives.
  async getCustomerOverview(userId: string): Promise<{
    user: {
      _id: string
      firstName: string
      lastName: string
      phone: string | null
      email: string | null
      isActive: boolean
      isVerified: boolean
      createdAt: Date
      banReason: string | null
      bannedAt: Date | null
    }
    wallet: { balance: number; currency: string }
    orders: Array<{
      _id: string
      orderNumber: string
      status: string
      total: number
      createdAt: Date
      restaurantId: string
    }>
    disputes: Array<{
      _id: string
      status: string
      type: string
      createdAt: Date
    }>
    refunds: Array<{
      _id: string
      status: string
      amountKobo: number
      createdAt: Date
    }>
  }> {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid userId')
    const uid = new Types.ObjectId(userId)

    // Fire the four reads in parallel — none depend on each other.
    const [user, wallet, orders, disputes, refunds] = await Promise.all([
      this.userModel
        .findById(uid)
        .select('firstName lastName phone email isActive isVerified createdAt banReason bannedAt')
        .lean() as unknown as Promise<{
          _id: Types.ObjectId
          firstName: string
          lastName: string
          phone: string | null
          email: string | null
          isActive: boolean
          isVerified: boolean
          createdAt: Date
          banReason: string | null
          bannedAt: Date | null
        } | null>,
      this.walletService.getBalance(userId),
      this.orderModel
        .find({ customerId: uid })
        .select('orderNumber status pricing.total createdAt restaurantId')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean() as unknown as Promise<Array<{
          _id: Types.ObjectId
          orderNumber: string
          status: string
          pricing: { total: number }
          createdAt: Date
          restaurantId: Types.ObjectId
        }>>,
      this.disputeModel
        .find({ customerId: uid })
        .select('status type createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean() as unknown as Promise<Array<{
          _id: Types.ObjectId
          status: string
          type: string
          createdAt: Date
        }>>,
      this.refundModel
        .find({ customerId: uid })
        .select('status amountKobo createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean() as unknown as Promise<Array<{
          _id: Types.ObjectId
          status: string
          amountKobo: number
          createdAt: Date
        }>>,
    ])

    if (!user) throw new NotFoundException('User not found')

    return {
      user: {
        _id:        user._id.toString(),
        firstName:  user.firstName,
        lastName:   user.lastName,
        phone:      user.phone,
        email:      user.email,
        isActive:   user.isActive,
        isVerified: user.isVerified,
        createdAt:  user.createdAt,
        banReason:  user.banReason,
        bannedAt:   user.bannedAt,
      },
      wallet,
      orders: orders.map((o) => ({
        _id:          o._id.toString(),
        orderNumber:  o.orderNumber,
        status:       o.status,
        total:        o.pricing.total,
        createdAt:    o.createdAt,
        restaurantId: o.restaurantId.toString(),
      })),
      disputes: disputes.map((d) => ({
        _id:       d._id.toString(),
        status:    d.status,
        type:      d.type,
        createdAt: d.createdAt,
      })),
      refunds: refunds.map((r) => ({
        _id:        r._id.toString(),
        status:     r.status,
        amountKobo: r.amountKobo,
        createdAt:  r.createdAt,
      })),
    }
  }

  // Targeted 1-1 push notification to a customer. Distinct from broadcasts
  // (S13-8), which fan out by role. Support agent uses this to reach out
  // about a specific ticket, refund, or delivery issue.
  async contactCustomer(args: {
    userId:     string
    title:      string
    body:       string
    actionUrl?: string
  }): Promise<{ delivered: boolean }> {
    if (!Types.ObjectId.isValid(args.userId)) throw new BadRequestException('Invalid userId')
    const user = await this.usersService.findById(args.userId).catch(() => null)
    if (!user) throw new NotFoundException('User not found')

    const data: Record<string, unknown> = {}
    if (args.actionUrl) data.actionUrl = args.actionUrl

    try {
      await this.notifications.send(
        args.userId,
        NotificationType.SYSTEM,
        args.title,
        args.body,
        data,
      )
      this.logger.log(`Contact-customer: sent "${args.title}" → ${args.userId}`)
      return { delivered: true }
    } catch (err) {
      this.logger.warn(`Contact-customer failed for ${args.userId}: ${(err as Error).message}`)
      return { delivered: false }
    }
  }

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
