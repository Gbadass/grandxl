import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'crypto'
import { Connection, Model, Types } from 'mongoose'
import { RiderDocument } from '../riders/schemas/rider.schema'
import {
  PayoutRequestDocument,
  PayoutStatus,
} from './schemas/payout-request.schema'
import { UpdateBankAccountDto } from './dto/payout.dto'

const PAYSTACK_BASE = 'https://api.paystack.co'

interface PaystackRecipientResponse {
  status: boolean
  data: { recipient_code: string; id: number }
}

interface PaystackTransferResponse {
  status: boolean
  data: { transfer_code: string; reference: string; status: string }
}

interface PaystackWebhookPayload {
  event: string
  data: {
    transfer_code:  string
    reference:      string
    amount:         number
    status:         string
    reason?:        string
    recipient?: { recipient_code: string }
  }
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name)
  private readonly paystackSecret: string

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @InjectModel(PayoutRequestDocument.name)
    private readonly payoutModel: Model<PayoutRequestDocument>,
    @InjectModel('RiderDocument')
    private readonly riderModel: Model<RiderDocument>,
    private readonly config: ConfigService,
  ) {
    this.paystackSecret = this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY')
  }

  // ── Bank account ────────────────────────────────────────────────

  async getBankAccount(userId: string) {
    const rider = await this.riderModel
      .findOne({ userId: new Types.ObjectId(userId) }, { bankAccount: 1 })
      .lean()
    return rider?.bankAccount ?? null
  }

  async updateBankAccount(userId: string, dto: UpdateBankAccountDto) {
    const rider = await this.riderModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
    if (!rider) throw new NotFoundException('Rider profile not found')

    // Create a Paystack Transfer Recipient so we can disburse instantly on approval.
    // If the rider changes their bank account, we create a fresh recipient.
    let recipientCode: string | null = rider.bankAccount?.paystackRecipientCode ?? null

    if (dto.bankCode) {
      try {
        recipientCode = await this.createOrFetchRecipient(
          dto.accountName,
          dto.accountNumber,
          dto.bankCode,
        )
      } catch (err) {
        this.logger.warn('Could not create Paystack recipient during bank account save', err)
        // Don't block the save — we'll create the recipient at payout time if missing
      }
    }

    const updated = await this.riderModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          bankAccount: {
            bankName:               dto.bankName,
            accountNumber:          dto.accountNumber,
            accountName:            dto.accountName,
            bankCode:               dto.bankCode ?? null,
            paystackRecipientCode:  recipientCode,
          },
        },
      },
      { new: true, projection: { bankAccount: 1 } },
    ).lean()

    return updated?.bankAccount
  }

  // ── Paystack helpers ─────────────────────────────────────────────

  async getBanksList(): Promise<{ id: number; name: string; code: string; active: boolean }[]> {
    const res = await fetch(
      `${PAYSTACK_BASE}/bank?country=nigeria&per_page=200&use_cursor=false`,
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    )
    if (!res.ok) throw new BadRequestException('Could not fetch banks list')
    const json = await res.json() as { data: { id: number; name: string; code: string; active: boolean }[] }
    return json.data.filter((b) => b.active)
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string; accountNumber: string }> {
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new BadRequestException('Account number must be exactly 10 digits')
    }
    const res = await fetch(
      `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    )
    const json = await res.json() as { status: boolean; data?: { account_name: string; account_number: string } }
    if (!res.ok || !json.status || !json.data) {
      throw new BadRequestException('Could not verify account — check the account number and bank')
    }
    return { accountName: json.data.account_name, accountNumber: json.data.account_number }
  }

  private async createOrFetchRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
  ): Promise<string> {
    const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type:           'nuban',
        name,
        account_number: accountNumber,
        bank_code:      bankCode,
        currency:       'NGN',
      }),
    })
    const json = await res.json() as PaystackRecipientResponse
    if (!res.ok || !json.status) {
      throw new InternalServerErrorException('Failed to create Paystack transfer recipient')
    }
    return json.data.recipient_code
  }

  private async initiateTransfer(
    recipientCode: string,
    amountKobo: number,
    reference: string,
    reason: string,
  ): Promise<{ transferCode: string; reference: string }> {
    const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source:    'balance',
        amount:    amountKobo,
        recipient: recipientCode,
        reason,
        reference,
      }),
    })
    const json = await res.json() as PaystackTransferResponse
    if (!res.ok || !json.status) {
      this.logger.error('Paystack transfer failed', JSON.stringify(json))
      throw new InternalServerErrorException('Failed to initiate Paystack transfer')
    }
    return { transferCode: json.data.transfer_code, reference: json.data.reference }
  }

  // ── Payout requests (rider-side) ────────────────────────────────

  async createRequest(userId: string, amountKobo: number) {
    const rider = await this.riderModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
    if (!rider) throw new NotFoundException('Rider profile not found')

    const bank = rider.bankAccount
    if (!bank?.bankName || !bank.accountNumber || !bank.accountName) {
      throw new BadRequestException('Add your bank account before requesting a payout')
    }
    if (amountKobo > rider.earnings.totalKobo) {
      throw new BadRequestException(
        `You only have ₦${(rider.earnings.totalKobo / 100).toFixed(0)} available`,
      )
    }

    const inFlight = await this.payoutModel.findOne({
      riderId: rider._id,
      status:  { $in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] },
    }).lean()
    if (inFlight) {
      throw new BadRequestException('You already have a payout request in progress')
    }

    return this.payoutModel.create({
      riderId:       rider._id,
      userId:        new Types.ObjectId(userId),
      amountKobo,
      bankName:      bank.bankName,
      accountNumber: bank.accountNumber,
      accountName:   bank.accountName,
      bankCode:      bank.bankCode ?? undefined,   // snapshot for recipient creation at approve time
      status:        PayoutStatus.PENDING,
    })
  }

  async listForRider(userId: string, page = 1, limit = 20) {
    const rider = await this.riderModel
      .findOne({ userId: new Types.ObjectId(userId) }, { _id: 1 })
      .lean()
    if (!rider) throw new ForbiddenException('Rider profile not found')

    const skip = (page - 1) * limit
    const filter = { riderId: rider._id }
    const [items, total] = await Promise.all([
      this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.payoutModel.countDocuments(filter),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  // ── Admin ────────────────────────────────────────────────────────

  async listForAdmin(status: PayoutStatus | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const filter = status ? { status } : {}
    const [items, total] = await Promise.all([
      this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.payoutModel.countDocuments(filter),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async approve(adminId: string, payoutId: string, note?: string) {
    const payout = await this.payoutModel.findById(payoutId)
    if (!payout) throw new NotFoundException('Payout request not found')
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(`Already ${payout.status}`)
    }

    // Get the rider's Paystack recipient code — create one on the fly if missing
    const rider = await this.riderModel
      .findById(payout.riderId, { bankAccount: 1 })
      .lean()
    if (!rider) throw new NotFoundException('Rider not found')

    const bank = rider.bankAccount
    // Prefer bank details snapshotted on the payout request (immutable), fall back to current bank account
    const accountNumber = payout.accountNumber ?? bank?.accountNumber
    const bankCode      = (payout as PayoutRequestDocument & { bankCode?: string }).bankCode ?? bank?.bankCode
    const accountName   = payout.accountName  ?? bank?.accountName ?? accountNumber

    if (!accountNumber || !bankCode) {
      throw new BadRequestException('Rider has no complete bank account on file')
    }

    let recipientCode = bank?.paystackRecipientCode ?? null
    if (!recipientCode) {
      recipientCode = await this.createOrFetchRecipient(
        accountName,
        accountNumber,
        bankCode,
      )
      await this.riderModel.updateOne(
        { _id: payout.riderId },
        { $set: { 'bankAccount.paystackRecipientCode': recipientCode } },
      )
    }

    // Initiate the transfer — Paystack debits our balance and sends to rider's bank.
    // Use the payout _id as the idempotency reference so retries won't double-pay.
    const reference = `payout_${payout._id.toString()}`
    const reason    = `GrandXL rider payout — ${payout.accountName}`
    const { transferCode } = await this.initiateTransfer(
      recipientCode,
      payout.amountKobo,
      reference,
      reason,
    )

    payout.status                = PayoutStatus.APPROVED
    payout.decidedBy             = new Types.ObjectId(adminId)
    payout.decidedAt             = new Date()
    payout.decisionNote          = note
    payout.transferReference     = reference
    payout.paystackTransferCode  = transferCode
    await payout.save()

    this.logger.log(`Payout ${payoutId} approved — Paystack transfer ${transferCode} initiated for ₦${(payout.amountKobo / 100).toFixed(0)}`)
    return payout
  }

  async reject(adminId: string, payoutId: string, note?: string) {
    const payout = await this.payoutModel.findById(payoutId)
    if (!payout) throw new NotFoundException('Payout request not found')
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(`Already ${payout.status}`)
    }
    payout.status       = PayoutStatus.REJECTED
    payout.decidedBy    = new Types.ObjectId(adminId)
    payout.decidedAt    = new Date()
    payout.decisionNote = note
    await payout.save()
    return payout
  }

  // Called manually by admin if needed, or automatically by Paystack webhook on transfer.success.
  // Both the payout status update and the rider earnings decrement run inside a MongoDB
  // transaction so a server crash between the two writes cannot leave them inconsistent.
  async markPaid(adminId: string, payoutId: string, transferReference: string, note?: string) {
    // Pre-flight checks outside the transaction to surface clear errors early.
    const payout = await this.payoutModel.findById(payoutId)
    if (!payout) throw new NotFoundException('Payout request not found')
    if (payout.status !== PayoutStatus.APPROVED) {
      throw new BadRequestException('Only approved payouts can be marked paid')
    }

    const session = await this.connection.startSession()
    try {
      let result!: PayoutRequestDocument
      await session.withTransaction(async () => {
        // Atomic test-and-set: only transition APPROVED → PAID once.
        // findOneAndUpdate rather than payout.save() prevents double-pay if two
        // admin requests arrive simultaneously.
        const updated = await this.payoutModel.findOneAndUpdate(
          { _id: payout._id, status: PayoutStatus.APPROVED },
          {
            $set: {
              status:            PayoutStatus.PAID,
              transferReference,
              paidAt:            new Date(),
              decisionNote:      note ?? payout.decisionNote,
              decidedBy:         new Types.ObjectId(adminId),
              decidedAt:         new Date(),
            },
          },
          { new: true, session },
        )
        if (!updated) {
          throw new BadRequestException('Payout is no longer in APPROVED state — concurrent update detected')
        }

        // Debit rider earnings — guarded by $gte so we can't go negative.
        // Runs in the same session/transaction as the payout status update.
        await this.riderModel.updateOne(
          { _id: payout.riderId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
          { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
          { session },
        )

        result = updated
      })
      return result
    } finally {
      await session.endSession()
    }
  }

  // ── Paystack webhook ─────────────────────────────────────────────

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const expected = createHmac('sha512', this.paystackSecret)
      .update(rawBody)
      .digest('hex')
    return expected === signature
  }

  async handleWebhookEvent(payload: PaystackWebhookPayload): Promise<void> {
    const { event, data } = payload

    if (event === 'transfer.success') {
      // Look up the payout before opening the transaction so we can return early
      // without holding a session if there is no matching record.
      const payout = await this.payoutModel.findOne({
        paystackTransferCode: data.transfer_code,
        status:               PayoutStatus.APPROVED,
      })
      if (!payout) {
        this.logger.warn(`transfer.success: no matching payout for transfer ${data.transfer_code}`)
        return
      }

      // Both writes run in a single transaction — if the server crashes between them
      // the session aborts and neither change is persisted, so we stay consistent.
      const session = await this.connection.startSession()
      try {
        await session.withTransaction(async () => {
          // Atomic test-and-set: ignore if a concurrent call already flipped to PAID.
          const updated = await this.payoutModel.findOneAndUpdate(
            { _id: payout._id, status: PayoutStatus.APPROVED },
            { $set: { status: PayoutStatus.PAID, paidAt: new Date() } },
            { new: true, session },
          )
          if (!updated) {
            // Already transitioned — idempotent, nothing to do.
            return
          }

          await this.riderModel.updateOne(
            { _id: payout.riderId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
            { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
            { session },
          )
        })
      } finally {
        await session.endSession()
      }

      this.logger.log(`Webhook: payout ${payout._id.toString()} marked PAID via transfer ${data.transfer_code}`)
    }

    if (event === 'transfer.failed' || event === 'transfer.reversed') {
      const payout = await this.payoutModel.findOne({
        paystackTransferCode: data.transfer_code,
        status:               PayoutStatus.APPROVED,
      })
      if (!payout) {
        this.logger.warn(`${event}: no matching payout for transfer ${data.transfer_code}`)
        return
      }

      // Mirror the transfer.success transaction pattern: both the payout status
      // rollback and the earnings restoration must be atomic. If only one persists,
      // the rider's earnings balance is permanently wrong.
      const session = await this.connection.startSession()
      try {
        await session.withTransaction(async () => {
          const reverted = await this.payoutModel.findOneAndUpdate(
            { _id: payout._id, status: PayoutStatus.APPROVED },
            {
              $set: {
                status:              PayoutStatus.PENDING,
                decisionNote:        `Transfer ${event.replace('transfer.', '')} — reason: ${data.reason ?? 'unknown'}. Will retry on next approval.`,
                paystackTransferCode: null,
                transferReference:    null,
              },
            },
            { new: true, session },
          )
          if (!reverted) {
            // Already transitioned by a concurrent call — idempotent, nothing to do.
            return
          }

          // Restore the rider's earnings so they can request a payout again.
          await this.riderModel.updateOne(
            { _id: payout.riderId },
            { $inc: { 'earnings.totalKobo': payout.amountKobo } },
            { session },
          )
        })
      } finally {
        await session.endSession()
      }

      this.logger.warn(`Webhook: payout ${payout._id.toString()} reverted to PENDING — ${event}`)
    }
  }
}
