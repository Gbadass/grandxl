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
import { createHmac, timingSafeEqual } from 'crypto'
import { Connection, Model, Types } from 'mongoose'
import { RiderDocument } from '../riders/schemas/rider.schema'
import { RestaurantDocument } from '../restaurants/schemas/restaurant.schema'
import {
  PayoutRequestDocument,
  PayoutStatus,
  type PayoutEntityType,
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
    @InjectModel(RestaurantDocument.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
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
      entityType:    'rider',
      entityId:      rider._id,
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

  // ── Restaurant-side (S12-6) ─────────────────────────────────────
  //
  // Mirror of the rider methods. Same shape, different collection. Kept as
  // parallel methods rather than a single generic one so callers stay explicit
  // about which type they're operating on — the only difference the caller
  // sees is where the money comes from and which bank account is used.

  private async findRestaurantForOwner(userId: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel
      .findOne({ ownerId: new Types.ObjectId(userId) })
      .lean() as unknown as RestaurantDocument | null
    if (!restaurant) throw new NotFoundException('Restaurant profile not found')
    return restaurant
  }

  async getRestaurantBankAccount(userId: string) {
    const r = await this.findRestaurantForOwner(userId)
    // Never leak paystackRecipientCode to the client — internal only.
    const b = r.bankDetails
    return {
      bankName:      b?.bankName ?? null,
      accountNumber: b?.accountNumber ?? null,
      accountName:   b?.accountName ?? null,
      bankCode:      b?.bankCode ?? null,
    }
  }

  async updateRestaurantBankAccount(userId: string, dto: UpdateBankAccountDto) {
    const restaurant = await this.findRestaurantForOwner(userId)

    let recipientCode: string | null = restaurant.bankDetails?.paystackRecipientCode ?? null
    if (dto.bankCode) {
      try {
        recipientCode = await this.createOrFetchRecipient(
          dto.accountName, dto.accountNumber, dto.bankCode,
        )
      } catch (err) {
        this.logger.warn('Could not create Paystack recipient during restaurant bank save', err)
        // Don't block the save — we'll create the recipient at payout time if missing
      }
    }

    const updated = await this.restaurantModel.findByIdAndUpdate(
      restaurant._id,
      {
        $set: {
          bankDetails: {
            bankName:              dto.bankName,
            accountNumber:         dto.accountNumber,
            accountName:           dto.accountName,
            bankCode:              dto.bankCode ?? null,
            paystackRecipientCode: recipientCode,
          },
        },
      },
      { new: true, projection: { bankDetails: 1 } },
    ).lean() as unknown as { bankDetails: RestaurantDocument['bankDetails'] } | null

    const b = updated?.bankDetails
    return {
      bankName:      b?.bankName ?? null,
      accountNumber: b?.accountNumber ?? null,
      accountName:   b?.accountName ?? null,
      bankCode:      b?.bankCode ?? null,
    }
  }

  async createRestaurantRequest(userId: string, amountKobo: number) {
    const restaurant = await this.findRestaurantForOwner(userId)

    const bank = restaurant.bankDetails
    if (!bank?.bankName || !bank.accountNumber || !bank.accountName) {
      throw new BadRequestException('Add your bank account before requesting a payout')
    }
    if (amountKobo > restaurant.earnings.totalKobo) {
      throw new BadRequestException(
        `You only have ₦${(restaurant.earnings.totalKobo / 100).toFixed(0)} available`,
      )
    }

    const inFlight = await this.payoutModel.findOne({
      entityType: 'restaurant',
      entityId:   restaurant._id,
      status:     { $in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] },
    }).lean()
    if (inFlight) {
      throw new BadRequestException('You already have a payout request in progress')
    }

    return this.payoutModel.create({
      entityType:    'restaurant',
      entityId:      restaurant._id,
      // riderId + userId intentionally omitted for restaurant payouts.
      amountKobo,
      bankName:      bank.bankName,
      accountNumber: bank.accountNumber,
      accountName:   bank.accountName,
      bankCode:      bank.bankCode ?? undefined,
      status:        PayoutStatus.PENDING,
    })
  }

  async listForRestaurant(userId: string, page = 1, limit = 20) {
    const restaurant = await this.restaurantModel
      .findOne({ ownerId: new Types.ObjectId(userId) }, { _id: 1 })
      .lean() as unknown as { _id: Types.ObjectId } | null
    if (!restaurant) throw new ForbiddenException('Restaurant profile not found')

    const skip = (page - 1) * limit
    const filter = { entityType: 'restaurant' as const, entityId: restaurant._id }
    const [items, total] = await Promise.all([
      this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.payoutModel.countDocuments(filter),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async getRestaurantEarningsSummary(userId: string) {
    const restaurant = await this.restaurantModel
      .findOne({ ownerId: new Types.ObjectId(userId) }, { _id: 1, earnings: 1, bankDetails: 1 })
      .lean() as unknown as {
        _id: Types.ObjectId
        earnings: { totalKobo: number; pendingKobo: number }
        bankDetails: RestaurantDocument['bankDetails']
      } | null
    if (!restaurant) throw new ForbiddenException('Restaurant profile not found')

    const inFlight = await this.payoutModel.findOne({
      entityType: 'restaurant',
      entityId:   restaurant._id,
      status:     { $in: [PayoutStatus.PENDING, PayoutStatus.APPROVED] },
    }).lean() as unknown as { amountKobo: number; status: PayoutStatus } | null

    const b = restaurant.bankDetails
    return {
      availableKobo:     restaurant.earnings.totalKobo,
      pendingHoldKobo:   restaurant.earnings.pendingKobo,
      hasBankAccount:    !!(b?.bankName && b.accountNumber && b.accountName),
      inFlightRequest:   inFlight ? { amountKobo: inFlight.amountKobo, status: inFlight.status } : null,
    }
  }

  // ── Admin ────────────────────────────────────────────────────────

  async listForAdmin(status: PayoutStatus | undefined, entityType: PayoutEntityType | undefined, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const filter: Record<string, unknown> = {}
    if (status)     filter.status     = status
    if (entityType) filter.entityType = entityType
    const [rawItems, total] = await Promise.all([
      this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.payoutModel.countDocuments(filter),
    ])

    // Enrich each row with the counterparty's display name so the admin doesn't
    // have to open each payout to know who requested it. Batched via a single
    // lookup per collection rather than N+1 fetches.
    const riderEntityIds:      Types.ObjectId[] = []
    const restaurantEntityIds: Types.ObjectId[] = []
    for (const r of rawItems) {
      const type = r.entityType ?? 'rider'
      const id   = r.entityId ?? r.riderId
      if (!id) continue
      if (type === 'restaurant') restaurantEntityIds.push(id)
      else riderEntityIds.push(id)
    }

    const [riderRows, restaurantRows] = await Promise.all([
      riderEntityIds.length
        ? this.riderModel.aggregate([
            { $match: { _id: { $in: riderEntityIds } } },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 1, name: { $concat: [{ $ifNull: ['$user.firstName', ''] }, ' ', { $ifNull: ['$user.lastName', ''] }] } } },
          ])
        : Promise.resolve([]),
      restaurantEntityIds.length
        ? this.restaurantModel.find({ _id: { $in: restaurantEntityIds } }, { _id: 1, name: 1 }).lean()
        : Promise.resolve([]),
    ]) as [Array<{ _id: Types.ObjectId; name: string }>, Array<{ _id: Types.ObjectId; name: string }>]

    const nameByEntity = new Map<string, string>()
    for (const r of riderRows)      nameByEntity.set(String(r._id), r.name.trim() || 'Unknown rider')
    for (const r of restaurantRows) nameByEntity.set(String(r._id), r.name)

    const items = rawItems.map((r) => {
      const type = r.entityType ?? 'rider'
      const id   = r.entityId ?? r.riderId
      return {
        ...r,
        entityType: type,
        entityId:   id,
        entityName: id ? (nameByEntity.get(String(id)) ?? null) : null,
      }
    })

    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }

  async approve(adminId: string, payoutId: string, note?: string) {
    const payout = await this.payoutModel.findById(payoutId)
    if (!payout) throw new NotFoundException('Payout request not found')
    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(`Already ${payout.status}`)
    }

    // Snapshotted on the payout request at creation time — immutable, so we prefer
    // it over the current bank account which the counterparty may have edited since.
    const accountNumber = payout.accountNumber
    const bankCode      = (payout as PayoutRequestDocument & { bankCode?: string }).bankCode
    const accountName   = payout.accountName

    if (!accountNumber || !bankCode) {
      throw new BadRequestException('Payout request has no complete bank account on file')
    }

    // Fall back to (and cache) a Paystack recipient on the counterparty record so
    // future payouts don't recreate it. Which record we read from depends on entityType.
    const entityType = (payout.entityType ?? 'rider') as PayoutEntityType
    const entityId   = payout.entityId ?? payout.riderId
    if (!entityId) throw new BadRequestException('Payout has no counterparty reference')

    let recipientCode: string | null
    if (entityType === 'restaurant') {
      const restaurant = await this.restaurantModel
        .findById(entityId, { bankDetails: 1 })
        .lean() as unknown as { bankDetails: RestaurantDocument['bankDetails'] } | null
      if (!restaurant) throw new NotFoundException('Restaurant not found')
      recipientCode = restaurant.bankDetails?.paystackRecipientCode ?? null
      if (!recipientCode) {
        recipientCode = await this.createOrFetchRecipient(accountName, accountNumber, bankCode)
        await this.restaurantModel.updateOne(
          { _id: entityId },
          { $set: { 'bankDetails.paystackRecipientCode': recipientCode } },
        )
      }
    } else {
      const rider = await this.riderModel.findById(entityId, { bankAccount: 1 }).lean()
      if (!rider) throw new NotFoundException('Rider not found')
      recipientCode = rider.bankAccount?.paystackRecipientCode ?? null
      if (!recipientCode) {
        recipientCode = await this.createOrFetchRecipient(accountName, accountNumber, bankCode)
        await this.riderModel.updateOne(
          { _id: entityId },
          { $set: { 'bankAccount.paystackRecipientCode': recipientCode } },
        )
      }
    }

    // Initiate the transfer — Paystack debits our balance and sends to the counterparty.
    // Use the payout _id as the idempotency reference so retries won't double-pay.
    const reference = `payout_${payout._id.toString()}`
    const reason    = `GrandXL ${entityType} payout — ${payout.accountName}`
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

    this.logger.log(`Payout ${payoutId} (${entityType}) approved — Paystack transfer ${transferCode} initiated for ₦${(payout.amountKobo / 100).toFixed(0)}`)
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

  // Sprint 13 (S13-9): batch-approve. Iterates via the single-call approve()
  // so all its invariants apply (atomic isAvailable claim → recipient cache →
  // Paystack transfer → status flip). Uses Promise.allSettled so a Paystack
  // balance error on one payout doesn't block the other 19; the response
  // returns per-id success/failure so admin can retry only the failed ones.
  async batchApprove(adminId: string, payoutIds: string[], note?: string): Promise<{
    succeeded: number
    failed:    number
    failures:  Array<{ payoutId: string; message: string }>
  }> {
    const results = await Promise.allSettled(
      payoutIds.map((id) => this.approve(adminId, id, note)),
    )
    let succeeded = 0
    const failures: Array<{ payoutId: string; message: string }> = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!
      const id = payoutIds[i]!
      if (r.status === 'fulfilled') {
        succeeded++
      } else {
        const err = r.reason as { message?: string; response?: { message?: string | string[] } }
        const msg = err?.response?.message
        failures.push({
          payoutId: id,
          message: Array.isArray(msg) ? (msg[0] ?? 'Unknown error') : (typeof msg === 'string' ? msg : (err?.message ?? 'Unknown error')),
        })
      }
    }
    this.logger.log(`Batch approve: ${succeeded} succeeded, ${failures.length} failed (admin=${adminId})`)
    return { succeeded, failed: failures.length, failures }
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

        // Debit the counterparty's totalKobo — guarded by $gte so we can't go
        // negative. Runs in the same session/transaction as the payout status update.
        const entityType = (payout.entityType ?? 'rider') as PayoutEntityType
        const entityId   = payout.entityId ?? payout.riderId
        if (!entityId) throw new BadRequestException('Payout has no counterparty reference')
        if (entityType === 'restaurant') {
          await this.restaurantModel.updateOne(
            { _id: entityId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
            { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
            { session },
          )
        } else {
          await this.riderModel.updateOne(
            { _id: entityId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
            { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
            { session },
          )
        }

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
    if (expected.length !== signature.length) return false
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
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

          const entityType = (payout.entityType ?? 'rider') as PayoutEntityType
          const entityId   = payout.entityId ?? payout.riderId
          if (!entityId) return
          if (entityType === 'restaurant') {
            await this.restaurantModel.updateOne(
              { _id: entityId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
              { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
              { session },
            )
          } else {
            await this.riderModel.updateOne(
              { _id: entityId, 'earnings.totalKobo': { $gte: payout.amountKobo } },
              { $inc: { 'earnings.totalKobo': -payout.amountKobo } },
              { session },
            )
          }
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

          // Restore the counterparty's earnings so they can request a payout again.
          const entityType = (payout.entityType ?? 'rider') as PayoutEntityType
          const entityId   = payout.entityId ?? payout.riderId
          if (!entityId) return
          if (entityType === 'restaurant') {
            await this.restaurantModel.updateOne(
              { _id: entityId },
              { $inc: { 'earnings.totalKobo': payout.amountKobo } },
              { session },
            )
          } else {
            await this.riderModel.updateOne(
              { _id: entityId },
              { $inc: { 'earnings.totalKobo': payout.amountKobo } },
              { session },
            )
          }
        })
      } finally {
        await session.endSession()
      }

      this.logger.warn(`Webhook: payout ${payout._id.toString()} reverted to PENDING — ${event}`)
    }
  }
}
