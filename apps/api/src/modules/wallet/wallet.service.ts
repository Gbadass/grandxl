import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { WalletDocument } from './schemas/wallet.schema'
import {
  WalletTransactionDocument,
  WalletTxnReason,
  WalletTxnType,
} from './schemas/wallet-transaction.schema'

interface MutationArgs {
  userId: string
  amount: number // kobo, positive
  reason: WalletTxnReason
  description?: string
  referenceType?: string
  referenceId?: string
}

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(WalletDocument.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(WalletTransactionDocument.name)
    private readonly txnModel: Model<WalletTransactionDocument>,
  ) {}

  // Ensures a wallet exists for the user — idempotent.
  async ensureWallet(userId: string): Promise<WalletDocument> {
    const uid = new Types.ObjectId(userId)
    let wallet = await this.walletModel.findOne({ userId: uid }).exec()
    if (!wallet) {
      wallet = await this.walletModel.create({ userId: uid, balance: 0 })
    }
    return wallet
  }

  async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const wallet = await this.ensureWallet(userId)
    return { balance: wallet.balance, currency: wallet.currency }
  }

  async credit(args: MutationArgs): Promise<{ balance: number }> {
    return this.mutate(args, WalletTxnType.CREDIT)
  }

  async debit(args: MutationArgs): Promise<{ balance: number }> {
    return this.mutate(args, WalletTxnType.DEBIT)
  }

  // Atomic balance update with ledger row. findOneAndUpdate with $inc gives us the
  // pre-update document and the post-update balance in a single op — no race.
  private async mutate(args: MutationArgs, type: WalletTxnType): Promise<{ balance: number }> {
    if (!Number.isInteger(args.amount) || args.amount <= 0) {
      throw new BadRequestException('amount must be a positive integer (kobo)')
    }

    const uid = new Types.ObjectId(args.userId)
    await this.ensureWallet(args.userId)

    const delta = type === WalletTxnType.CREDIT ? args.amount : -args.amount

    if (type === WalletTxnType.DEBIT) {
      // Guard against overdraft. Filter by balance >= amount; if no doc matches, throw.
      const updated = await this.walletModel.findOneAndUpdate(
        { userId: uid, balance: { $gte: args.amount } },
        { $inc: { balance: delta } },
        { new: true },
      ).exec()
      if (!updated) throw new BadRequestException('Insufficient wallet balance')
      const balanceAfter  = updated.balance
      const balanceBefore = balanceAfter - delta
      await this.txnModel.create({
        userId:       uid,
        type,
        reason:       args.reason,
        amount:       args.amount,
        balanceBefore,
        balanceAfter,
        description:  args.description,
        referenceType: args.referenceType,
        referenceId:   args.referenceId,
      })
      return { balance: balanceAfter }
    }

    const updated = await this.walletModel.findOneAndUpdate(
      { userId: uid },
      { $inc: { balance: delta } },
      { new: true },
    ).exec()
    if (!updated) throw new BadRequestException('Wallet not found')
    const balanceAfter  = updated.balance
    const balanceBefore = balanceAfter - delta
    await this.txnModel.create({
      userId:       uid,
      type,
      reason:       args.reason,
      amount:       args.amount,
      balanceBefore,
      balanceAfter,
      description:  args.description,
      referenceType: args.referenceType,
      referenceId:   args.referenceId,
    })
    return { balance: balanceAfter }
  }

  async listTransactions(userId: string, page = 1, limit = 20) {
    const uid  = new Types.ObjectId(userId)
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.txnModel.find({ userId: uid }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.txnModel.countDocuments({ userId: uid }).exec(),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  }
}
