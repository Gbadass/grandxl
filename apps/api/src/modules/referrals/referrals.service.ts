import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { ReferralDocument } from './schemas/referral.schema'
import { UsersService } from '../users/users.service'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'

// ₦500 referral reward expressed in kobo
const REFERRAL_REWARD_KOBO = 50_000

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name)

  constructor(
    @InjectModel(ReferralDocument.name)
    private readonly referralModel: Model<ReferralDocument>,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
  ) {}

  // ── Apply a referral code (called during new user registration) ──────────

  async applyReferralCode(newUserId: string, code: string): Promise<void> {
    // Look up the referrer by code
    const referrer = await this.usersService.findByReferralCode(code)
    if (!referrer) {
      this.logger.warn(`applyReferralCode: code "${code}" not found — skipping`)
      return
    }

    const referrerId = (referrer._id as Types.ObjectId).toString()

    // Prevent self-referral
    if (referrerId === newUserId) {
      throw new BadRequestException('You cannot use your own referral code')
    }

    // Guard: one referral per referee (the unique index enforces this in Mongo,
    // but we surface a friendlier message here)
    const existing = await this.referralModel.findOne({
      refereeId: new Types.ObjectId(newUserId),
    })
    if (existing) {
      throw new BadRequestException('A referral code has already been applied to this account')
    }

    await this.referralModel.create({
      referrerId: new Types.ObjectId(referrerId),
      refereeId:  new Types.ObjectId(newUserId),
      status:     'pending',
      rewardAmountKobo: REFERRAL_REWARD_KOBO,
    })

    this.logger.log(`Referral created: referrer=${referrerId} referee=${newUserId}`)
  }

  // ── Called when the referee completes their first order ──────────────────

  async onFirstOrderCompleted(orderId: string, customerId: string): Promise<void> {
    // Atomically flip status from pending → rewarded. If two concurrent DELIVERED
    // events race here, only one will match the { status: 'pending' } filter and
    // get the document back. The other receives null and exits — no double credit.
    const referral = await this.referralModel.findOneAndUpdate(
      { refereeId: new Types.ObjectId(customerId), status: 'pending' },
      { $set: { status: 'rewarded', refereeOrderId: new Types.ObjectId(orderId) } },
      { new: false }, // return the pre-update doc so we have rewardAmountKobo
    )

    if (!referral) return // Not a referred user, or already rewarded by a concurrent call

    try {
      await this.walletService.credit({
        userId:        referral.referrerId.toString(),
        amount:        referral.rewardAmountKobo,
        reason:        WalletTxnReason.REFERRAL,
        description:   `Referral reward — friend placed their first order`,
        referenceType: 'referral',
        referenceId:   (referral._id as Types.ObjectId).toString(),
      })

      this.logger.log(
        `Referral rewarded: referrer=${referral.referrerId} reward=${referral.rewardAmountKobo} kobo orderId=${orderId}`,
      )
    } catch (err) {
      // Wallet credit failed after we already flipped status — roll back so the
      // reward can be retried manually rather than being silently lost.
      await this.referralModel.findByIdAndUpdate(referral._id, { $set: { status: 'pending', refereeOrderId: null } })
      this.logger.error(`Failed to credit referral reward — status rolled back: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  // ── GET /referrals/me ────────────────────────────────────────────────────

  async getMyReferralInfo(
    userId: string,
  ): Promise<{ referralCode: string | null; referralCount: number; totalEarnedKobo: number }> {
    const user = await this.usersService.findById(userId)
    if (!user) throw new NotFoundException('User not found')

    const rewarded = await this.referralModel
      .find({ referrerId: new Types.ObjectId(userId), status: 'rewarded' })
      .lean()

    const totalEarnedKobo = rewarded.reduce((sum, r) => sum + (r.rewardAmountKobo ?? 0), 0)

    return {
      referralCode:    user.referralCode,
      referralCount:   rewarded.length,
      totalEarnedKobo,
    }
  }
}
