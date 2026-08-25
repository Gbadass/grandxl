import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { Model, Types } from 'mongoose'
import * as crypto from 'crypto'
import { TransactionDocument } from './schemas/transaction.schema'
import { OrdersService } from '../orders/orders.service'
import { UsersService } from '../users/users.service'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { FraudService } from '../fraud/fraud.service'
import { PaymentMethod, PaymentStatus } from '@grandxl/types'
import type { InitiatePaymentDto } from './dto/initiate-payment.dto'

// Paystack base URL — no axios dependency, use native fetch (Node 18+)
const PAYSTACK_BASE = 'https://api.paystack.co'
const PAYSTACK_TIMEOUT_MS = 10_000 // 10s — abort if Paystack doesn't respond

function paystackFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly paystackSecret: string

  constructor(
    @InjectModel(TransactionDocument.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
    private readonly fraudService: FraudService,
    private readonly config: ConfigService,
  ) {
    this.paystackSecret = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY')
  }

  // ── Wallet top-up via Paystack ────────────────────────────────────

  async initiateWalletTopUp(
    customerId: string,
    amountKobo: number,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    if (!Number.isInteger(amountKobo) || amountKobo < 100_00) {
      throw new BadRequestException('Top-up amount must be at least ₦100')
    }
    if (amountKobo > 500_000_00) {
      throw new BadRequestException('Top-up amount cannot exceed ₦500,000')
    }

    const reference = `WAL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    await this.transactionModel.create({
      userId:   new Types.ObjectId(customerId),
      orderId:  null,
      type:     'wallet_topup',
      method:   PaymentMethod.PAYSTACK,
      status:   PaymentStatus.PENDING,
      amount:   amountKobo,
      reference,
      country:  'NG',
      currency: 'NGN',
    })

    const customer = await this.usersService.findById(customerId)
    const customerEmail = customer?.email ?? `${customerId}@grandxl.com`

    const response = await paystackFetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:    customerEmail,
        amount:   amountKobo,
        reference,
        currency: 'NGN',
        // Webhook uses purpose to route the charge.success → wallet credit
        metadata: { purpose: 'wallet_topup', customerId, amountKobo },
      }),
    })

    const json = (await response.json()) as {
      status: boolean
      data?: { authorization_url: string; reference: string }
      message?: string
    }
    if (!json.status || !json.data) {
      this.logger.error('Paystack initialize (wallet topup) failed', json)
      throw new BadRequestException('Wallet top-up failed — please try again')
    }

    return { authorizationUrl: json.data.authorization_url, reference: json.data.reference }
  }

  // ── Initiate Paystack charge ─────────────────────────────────────

  async initiatePayment(
    customerId: string,
    dto: InitiatePaymentDto,
  ): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
    const order = await this.ordersService.getOrderById(dto.orderId)
    if (order.customerId.toString() !== customerId) {
      throw new ForbiddenException('You do not own this order')
    }
    if (order.payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is already paid')
    }
    if (dto.method !== PaymentMethod.PAYSTACK) {
      throw new BadRequestException('Only Paystack is supported at this time')
    }

    // Wallet may have covered part of the order at create time.
    // Charge only what's left after the wallet credit.
    const amountToCharge = order.pricing.total - (order.pricing.walletApplied ?? 0)
    if (amountToCharge <= 0) {
      throw new BadRequestException('Order is fully paid by wallet — no card charge needed')
    }

    // Create a pending transaction record before calling Paystack
    const reference = `GXL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    await this.transactionModel.create({
      userId: new Types.ObjectId(customerId),
      orderId: new Types.ObjectId(dto.orderId),
      type: 'order_payment',
      method: PaymentMethod.PAYSTACK,
      status: PaymentStatus.PENDING,
      amount: amountToCharge,
      reference,
      country: order.country,
      currency: order.currency,
    })

    // Look up customer email for Paystack (required for payment receipts)
    const customer = await this.usersService.findById(customerId)
    const customerEmail = customer?.email ?? `${customerId}@grandxl.com`

    // Call Paystack initialize
    const body: Record<string, unknown> = {
      email: customerEmail,
      amount: amountToCharge, // kobo, post-wallet
      reference,
      currency: order.currency,
      metadata: {
        orderId: dto.orderId,
        customerId,
        orderNumber: order.orderNumber,
      },
    }

    if (dto.callbackUrl) {
      body.callback_url = dto.callbackUrl
    }

    const response = await paystackFetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const json = (await response.json()) as {
      status: boolean
      data?: { authorization_url: string; access_code: string; reference: string }
      message?: string
    }

    if (!json.status || !json.data) {
      this.logger.error('Paystack initialize failed', json)
      throw new BadRequestException('Payment initialization failed — please try again')
    }

    return {
      authorizationUrl: json.data.authorization_url,
      accessCode:       json.data.access_code,
      reference:        json.data.reference,
    }
  }

  // ── Paystack webhook ─────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    // Verify HMAC-SHA512 signature
    const expectedSig = crypto
      .createHmac('sha512', this.paystackSecret)
      .update(rawBody)
      .digest('hex')

    if (
      expectedSig.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))
    ) {
      throw new UnauthorizedException('Invalid webhook signature')
    }

    const event = JSON.parse(rawBody.toString()) as {
      event: string
      data: {
        reference: string
        status: string
        amount: number
        metadata?: { orderId?: string }
      }
    }

    this.logger.log(`Paystack webhook: ${event.event}`)

    if (event.event === 'charge.success') {
      await this.handleChargeSuccess(event.data)
    } else if (event.event === 'charge.failed') {
      await this.handleChargeFailed(event.data)
    }
    // Other events (refund.*, transfer.*) handled in future phases
  }

  private async handleChargeSuccess(data: {
    reference: string
    amount: number
    metadata?: { orderId?: string; purpose?: string }
  }): Promise<void> {
    // Atomic flip: only one concurrent call can win the PENDING → COMPLETED transition.
    // findOneAndUpdate with { status: PENDING } as filter acts as a test-and-set —
    // if another call already flipped it, this returns null and we skip processing.
    const transaction = await this.transactionModel.findOneAndUpdate(
      { reference: data.reference, status: PaymentStatus.PENDING },
      { $set: { status: PaymentStatus.COMPLETED, paystackData: data as unknown as Record<string, unknown> } },
      { new: false }, // return pre-update doc so we have the original fields
    )
    if (!transaction) {
      // Either unknown reference or already processed — both are safe to ignore
      this.logger.log(`handleChargeSuccess: no PENDING transaction for ref ${data.reference} (already processed or unknown)`)
      return
    }

    // Route by transaction type. Wallet top-up credits the ledger; order
    // payment finalizes the order. Refund webhook handling lands later.
    if (transaction.type === 'wallet_topup') {
      await this.walletService.credit({
        userId:        transaction.userId.toString(),
        amount:        transaction.amount,
        reason:        WalletTxnReason.TOP_UP,
        description:   `Top-up via Paystack`,
        referenceType: 'paystack_transaction',
        referenceId:   transaction.reference ?? data.reference,
      })
      return
    }

    if (transaction.orderId) {
      const order = await this.ordersService.markPaymentComplete(
        transaction.orderId.toString(),
        data.reference,
      )
      // null = order was not PENDING (already confirmed or cancelled).
      // Paystack may retry webhooks — this is expected and safe to ignore.
      if (!order) return
    }
  }

  private async handleChargeFailed(data: { reference: string }): Promise<void> {
    const transaction = await this.transactionModel.findOne({ reference: data.reference })
    if (!transaction) return

    await this.transactionModel.findByIdAndUpdate(transaction._id, {
      $set: {
        status: PaymentStatus.FAILED,
        paystackData: data as unknown as Record<string, unknown>,
      },
    })

    if (transaction.orderId) {
      await this.ordersService.markPaymentFailed(transaction.orderId.toString())
    }

    // Fraud check — 3+ failed charges in 24h auto-flags the account.
    // Fire-and-forget; failure to write a risk flag mustn't break webhook handling.
    this.fraudService
      .evaluatePaymentFailures(transaction.userId.toString())
      .catch(() => undefined)
  }

  // ── Verify a payment reference (polling fallback for mobile/web) ──

  async verifyPayment(
    reference: string,
    customerId: string,
  ): Promise<{ verified: boolean; status: string; orderId: string | null; amount: number }> {
    const transaction = await this.transactionModel.findOne({ reference })
    if (!transaction) throw new NotFoundException('Transaction not found')
    if (transaction.userId.toString() !== customerId) {
      throw new ForbiddenException('You do not own this transaction')
    }

    // If still pending, check Paystack directly to bridge the race between the
    // user landing on the callback page and the webhook arriving. The webhook
    // handler is idempotent so a duplicate call here is safe.
    if (transaction.status === PaymentStatus.PENDING) {
      try {
        const res = await paystackFetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${this.paystackSecret}` },
        })
        const json = (await res.json()) as {
          status: boolean
          data?: {
            status: string
            amount: number
            metadata?: { orderId?: string; purpose?: string }
          }
        }

        if (json.status && json.data?.status === 'success') {
          await this.handleChargeSuccess({
            reference,
            amount: json.data.amount,
            metadata: json.data.metadata,
          })
          // Re-fetch to get the updated status the handler just wrote
          const updated = await this.transactionModel.findOne({ reference })
          if (updated) {
            return {
              verified: updated.status === PaymentStatus.COMPLETED,
              status: updated.status,
              orderId: updated.orderId?.toString() ?? null,
              amount: updated.amount,
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Paystack live-verify failed for ${reference}`, err)
        // Non-critical — webhook will arrive shortly; return current DB state
      }
    }

    return {
      verified: transaction.status === PaymentStatus.COMPLETED,
      status: transaction.status,
      orderId: transaction.orderId?.toString() ?? null,
      amount: transaction.amount,
    }
  }

  // ── Initiate Paystack refund for a cancelled order ───────────────

  async initiateRefund(orderId: string, reason: string): Promise<void> {
    // Find the completed card transaction for this order
    const txn = await this.transactionModel.findOne({
      orderId: new Types.ObjectId(orderId),
      type: 'order_payment',
      status: PaymentStatus.COMPLETED,
    })
    if (!txn) return // wallet-only or not yet paid — nothing to refund

    // Call Paystack refund API
    const res = await paystackFetch(`${PAYSTACK_BASE}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: txn.reference,
        amount: txn.amount, // kobo — full refund
        merchant_note: reason,
      }),
    })
    const json = (await res.json()) as { status: boolean; message?: string }
    if (!json.status) {
      this.logger.error(`Paystack refund failed for order ${orderId}`, json)
      // Don't throw — wallet was already refunded, log and continue
      return
    }
    // Mark transaction as refunded
    await this.transactionModel.findByIdAndUpdate(txn._id, {
      $set: { status: PaymentStatus.REFUNDED },
    })
    this.logger.log(`Paystack refund initiated for order ${orderId}, ref ${txn.reference}`)
  }

  // ── Customer transaction history ─────────────────────────────────

  async getMyTransactions(
    customerId: string,
    page = 1,
    limit = 20,
  ): Promise<{ transactions: TransactionDocument[]; total: number }> {
    const filter = { userId: new Types.ObjectId(customerId) }
    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.transactionModel.countDocuments(filter),
    ])

    return { transactions: transactions as unknown as TransactionDocument[], total }
  }
}
