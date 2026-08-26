import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { RiderOnlineSessionDocument } from './schemas/rider-online-session.schema'

// If a rider closes their browser without going offline, their RiderOnlineSession
// stays open (endAt=null) forever. The utilization query in AnalyticsService
// already caps the compute-side at 12h (STALE_SESSION_MS), but the underlying
// documents grow unbounded. This sweeper closes them out for real, so the
// collection stays tidy and future readers see accurate historical state.
//
// Runs on an interval (not BullMQ) so it survives Redis outages — a stuck Redis
// is exactly the scenario that leaves orphan sessions.

const SWEEP_INTERVAL_MS = 15 * 60 * 1000   // 15 minutes
const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000 // sessions open >12h are considered abandoned

@Injectable()
export class StaleSessionSweeperService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StaleSessionSweeperService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(
    @InjectModel(RiderOnlineSessionDocument.name)
    private readonly sessionModel: Model<RiderOnlineSessionDocument>,
  ) {}

  onApplicationBootstrap(): void {
    // Fire once at startup so we don't wait 15 min for the first cleanup after a deploy
    void this.sweep().catch((err) => this.logger.error(`initial sweep failed: ${String(err)}`))
    this.timer = setInterval(() => {
      void this.sweep().catch((err) => this.logger.error(`sweep failed: ${String(err)}`))
    }, SWEEP_INTERVAL_MS)
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS)
    // Close sessions whose startAt is old enough that we're confident the rider isn't
    // still doing a legit shift. endAt is set to startAt + threshold — matches how
    // the utilization aggregation clamps in-place computations.
    const result = await this.sessionModel.updateMany(
      { endAt: null, startAt: { $lt: cutoff } },
      [{ $set: { endAt: { $add: ['$startAt', STALE_THRESHOLD_MS] } } }],
    )
    if (result.modifiedCount > 0) {
      this.logger.warn(`Closed ${result.modifiedCount} stale rider online session(s)`)
    }
  }
}
