import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { OrderDocument } from '../orders/schemas/order.schema'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { FraudService } from '../fraud/fraud.service'
import {
  RefundRequestDocument,
  RefundStatus,
  RefundMethod,
} from './schemas/refund-request.schema'
import { CreateRefundRequestDto } from './dto/create-refund-request.dto'

const PAYSTACK_BASE = 'https://api.paystack.co'

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name)
  private readonly paystackSecret: string

  constructor(
    @InjectModel(RefundRequestDocument.name)
    private readonly refundModel: Model<RefundRequestDocument>,
    @InjectModel('OrderDocument')
    private readonly orderModel: Model<OrderDocument>,
    private readonly walletService: WalletService,
    private readonly fraudService: FraudService,
    private readonly config: ConfigService,
  ) {
    this.paystackSecret = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY')
  }

  // ── Customer-facing ──────────────────────────────────────────────────

  async createRequest(customerId: string, dto: CreateRefundRequestDto): Promise<RefundRequestDocument> {
    const order = await this.orderModel.findById(dto.orderId).exec()
    if (!order) throw new NotFoundException('Order not found')
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('You do not own this order')
    }
    if (dto.amountKobo > order.pricing.total) {
      throw new BadRequestException('Refund amount cannot exceed the order total')
    }

    // Block duplicate active requests on the same order.
    const existing = await this.refundModel.findOne({
      orderId: order._id,
      status:  { $in: [RefundStatus.PENDING, RefundStatus.APPROVED] },
    }).exec()
    if (existing) {
      throw new BadRequestException('A refund request for this order is already in progress')
    }

    const request = await this.refundModel.create({
      orderId:    order._id,
      customerId: new Types.ObjectId(customerId),
      amountKobo: dto.amountKobo,
      reason:     dto.reason,
      status:     RefundStatus.PENDING,
    })

    // Fraud check — 2+ refund requests in 7d auto-flags the account.
    this.fraudService.evaluateRefundVelocity(customerId).catch(() => undefined)

    return request
  }

  async listForCustomer(customerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const filter = { customerId: new Types.ObjectId(customerId) }
    const [items, total] = await Promise.all([
      this.refundModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.refundModel.countDocuments(filter).exec(),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  // ── Admin-facing ─────────────────────────────────────────────────────

  async listForAdmin(status: RefundStatus | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const filter = status ? { status } : {}
    const [items, total] = await Promise.all([
      this.refundModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.refundModel.countDocuments(filter).exec(),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async approve(
    adminId: string,
    refundId: string,
    method: RefundMethod,
    note?: string,
  ): Promise<RefundRequestDocument> {
    const refund = await this.refundModel.findById(refundId).exec()
    if (!refund) throw new NotFoundException('Refund request not found')
    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(`Refund is already ${refund.status}`)
    }

    refund.status        = RefundStatus.APPROVED
    refund.method        = method
    refund.decidedBy     = new Types.ObjectId(adminId)
    refund.decidedAt     = new Date()
    refund.decisionNote  = note
    await refund.save()

    // Execute the refund. Original-card via Paystack; wallet via wallet ledger.
    try {
      if (method === RefundMethod.WALLET) {
        const txn = await this.walletService.credit({
          userId:        refund.customerId.toString(),
          amount:        refund.amountKobo,
          reason:        WalletTxnReason.REFUND,
          description:   `Refund for order`,
          referenceType: 'order',
          referenceId:   refund.orderId.toString(),
        })
        refund.walletTransactionId = (txn as unknown as { _id?: unknown })?._id?.toString()
        refund.status              = RefundStatus.COMPLETED
        await refund.save()
      } else {
        const reference = await this.issuePaystackRefund(refund.orderId.toString(), refund.amountKobo)
        refund.paystackRefundReference = reference
        // Paystack refunds are async — webhook will move to COMPLETED on confirmation.
        // For now we leave status as APPROVED and surface a "processing" state.
        await refund.save()
      }
    } catch (err) {
      this.logger.error(`refund execution failed: ${(err as Error).message}`, (err as Error).stack)
      refund.status = RefundStatus.FAILED
      await refund.save()
      throw err
    }

    return refund
  }

  async reject(
    adminId: string,
    refundId: string,
    note?: string,
  ): Promise<RefundRequestDocument> {
    const refund = await this.refundModel.findById(refundId).exec()
    if (!refund) throw new NotFoundException('Refund request not found')
    if (refund.status !== RefundStatus.PENDING) {
      throw new BadRequestException(`Refund is already ${refund.status}`)
    }
    refund.status       = RefundStatus.REJECTED
    refund.decidedBy    = new Types.ObjectId(adminId)
    refund.decidedAt    = new Date()
    refund.decisionNote = note
    await refund.save()
    return refund
  }

  // ── Paystack integration ─────────────────────────────────────────────

  private async issuePaystackRefund(orderId: string, amountKobo: number): Promise<string> {
    const order = await this.orderModel.findById(orderId).exec()
    if (!order?.payment.reference) {
      throw new BadRequestException('Order has no payment reference — cannot refund to source')
    }

    const response = await fetch(`${PAYSTACK_BASE}/refund`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: order.payment.reference,
        amount:      amountKobo,
      }),
    })
    const json = (await response.json()) as {
      status:  boolean
      message: string
      data?:   { id: string; transaction: { reference: string } }
    }
    if (!json.status || !json.data) {
      throw new BadRequestException(`Paystack refund failed: ${json.message}`)
    }
    return json.data.transaction.reference
  }
}
