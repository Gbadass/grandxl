import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Inject, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Model } from 'mongoose'
import {
  PendingSideEffectDocument,
  SideEffectType,
  SideEffectStatus,
} from './schemas/pending-side-effect.schema'
import { RIDER_DISPATCH_QUEUE } from '../jobs/constants/queue.constants'
import { WalletService } from '../wallet/wallet.service'
import { WalletTxnReason } from '../wallet/schemas/wallet-transaction.schema'
import { RidersService } from '../riders/riders.service'

const SWEEP_INTERVAL_MS = 30_000
const MAX_ATTEMPTS = 10
// Simple linear backoff — wait N * 30s between attempts. Enough breathing room
// for a Redis or Mongo blip to recover without hammering.
const BACKOFF_STEP_MS = 30_000

interface DispatchOrderPayload  { orderId: string; lat: number; lng: number }
interface WalletRefundPayload   { userId: string; amount: number; description: string; referenceId: string }
interface ReleaseRiderPayload   { riderId: string }

@Injectable()
export class SideEffectsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SideEffectsService.name)
  private sweepTimer: NodeJS.Timeout | null = null

  constructor(
    @InjectModel(PendingSideEffectDocument.name)
    private readonly effectModel: Model<PendingSideEffectDocument>,
    @InjectQueue(RIDER_DISPATCH_QUEUE) private readonly riderDispatchQueue: Queue,
    private readonly walletService: WalletService,
    @Inject(forwardRef(() => RidersService)) private readonly ridersService: RidersService,
  ) {}

  onApplicationBootstrap(): void {
    // Kick off the sweeper. Loop is best-effort — a crash just delays retries;
    // the next boot resumes work from Mongo state.
    this.sweepTimer = setInterval(() => {
      void this.sweep().catch((err) => this.logger.error(`side-effect sweep failed: ${String(err)}`))
    }, SWEEP_INTERVAL_MS)
  }

  onApplicationShutdown(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
  }

  // Try the primary operation. On failure, persist the intent as a pending side-effect
  // so the sweeper can retry it later. Never throws — callers use this precisely
  // because they can't handle failure inline.
  async tryOrEnqueue<TPayload extends Record<string, unknown>>(
    type: SideEffectType,
    idempotencyKey: string,
    payload: TPayload,
    primary: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await primary()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.logger.warn(`primary side-effect failed (${type}/${idempotencyKey}): ${errMsg} — enqueuing for retry`)
      await this.effectModel.updateOne(
        { idempotencyKey },
        {
          $setOnInsert: { type, payload, status: SideEffectStatus.PENDING, attempts: 0, createdAt: new Date() },
          $set: { lastError: errMsg },
        },
        { upsert: true },
      ).catch((persistErr) => {
        // If even the persist fails, we've truly lost the side-effect. Log LOUDLY.
        this.logger.error(
          `CRITICAL: failed to persist pending side-effect ${type}/${idempotencyKey}. ` +
          `Original error: ${errMsg}. Persist error: ${String(persistErr)}`,
        )
      })
    }
  }

  // The sweeper. Reads a batch of pending effects, executes them, updates state.
  // Runs every SWEEP_INTERVAL_MS ~30s. Backoff = N * 30s between attempts per effect.
  async sweep(): Promise<void> {
    const now = Date.now()
    const cutoff = new Date(now - BACKOFF_STEP_MS)
    const batch = await this.effectModel
      .find({
        status: SideEffectStatus.PENDING,
        $or: [
          { lastAttemptAt: null },
          { lastAttemptAt: { $lte: cutoff } },
        ],
      })
      .limit(50)
      .sort({ createdAt: 1 })

    for (const effect of batch) {
      // Backoff based on attempt count — attempt N waits N * 30s since last
      const requiredWaitMs = effect.attempts * BACKOFF_STEP_MS
      if (effect.lastAttemptAt && now - effect.lastAttemptAt.getTime() < requiredWaitMs) continue

      try {
        await this.execute(effect.type, effect.payload)
        await this.effectModel.updateOne(
          { _id: effect._id },
          { $set: { status: SideEffectStatus.COMPLETED, lastAttemptAt: new Date(), lastError: null } },
        )
        this.logger.log(`✓ side-effect ${effect.type}/${effect.idempotencyKey} completed (attempt ${effect.attempts + 1})`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        const nextAttempts = effect.attempts + 1
        const shouldDie = nextAttempts >= MAX_ATTEMPTS
        await this.effectModel.updateOne(
          { _id: effect._id },
          { $set: {
              attempts: nextAttempts,
              lastAttemptAt: new Date(),
              lastError: errMsg,
              status: shouldDie ? SideEffectStatus.DEAD : SideEffectStatus.PENDING,
          } },
        )
        if (shouldDie) {
          this.logger.error(
            `☠ side-effect ${effect.type}/${effect.idempotencyKey} DEAD after ${nextAttempts} attempts. ` +
            `Manual intervention required. Last error: ${errMsg}`,
          )
        } else {
          this.logger.warn(`↻ side-effect ${effect.type}/${effect.idempotencyKey} retry ${nextAttempts}/${MAX_ATTEMPTS} failed: ${errMsg}`)
        }
      }
    }
  }

  // Executor router. Each type maps to its own executor. Adding a new type =
  // add a case here + update the enum.
  private async execute(type: SideEffectType, payload: Record<string, unknown>): Promise<void> {
    switch (type) {
      case SideEffectType.DISPATCH_ORDER: {
        const p = payload as unknown as DispatchOrderPayload
        // jobId ensures idempotency — BullMQ dedupes if the same jobId already ran.
        await this.riderDispatchQueue.add(
          'dispatch',
          { orderId: p.orderId, lat: p.lat, lng: p.lng },
          { jobId: `dispatch-${p.orderId}` },
        )
        return
      }
      case SideEffectType.WALLET_REFUND: {
        const p = payload as unknown as WalletRefundPayload
        await this.walletService.credit({
          userId:        p.userId,
          amount:        p.amount,
          reason:        WalletTxnReason.REFUND,
          description:   p.description,
          referenceType: 'order',
          referenceId:   p.referenceId,
        })
        return
      }
      case SideEffectType.RELEASE_RIDER: {
        const p = payload as unknown as ReleaseRiderPayload
        await this.ridersService.releaseRider(p.riderId)
        return
      }
    }
  }

  // Admin observability — how many effects are stuck?
  async getStats(): Promise<{ pending: number; dead: number; oldestPendingAt: Date | null }> {
    const [pending, dead, oldest] = await Promise.all([
      this.effectModel.countDocuments({ status: SideEffectStatus.PENDING }),
      this.effectModel.countDocuments({ status: SideEffectStatus.DEAD }),
      this.effectModel.findOne({ status: SideEffectStatus.PENDING }).sort({ createdAt: 1 }).select('createdAt'),
    ])
    return { pending, dead, oldestPendingAt: oldest?.createdAt ?? null }
  }
}
