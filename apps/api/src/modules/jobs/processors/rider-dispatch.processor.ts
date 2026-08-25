import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RIDER_DISPATCH_QUEUE, RIDER_DISPATCH_MAX_ATTEMPTS } from '../constants/queue.constants'
import { OrdersService } from '../../orders/orders.service'
import { RidersService } from '../../riders/riders.service'
import { TrackingService } from '../../tracking/tracking.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { OrderStatus, NotificationType } from '@grandxl/types'

export interface RiderDispatchJobData {
  orderId: string
  lng: number
  lat: number
}

@Processor(RIDER_DISPATCH_QUEUE)
export class RiderDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(RiderDispatchProcessor.name)

  constructor(
    private readonly ordersService: OrdersService,
    private readonly ridersService: RidersService,
    private readonly trackingService: TrackingService,
    private readonly notificationsService: NotificationsService,
  ) {
    super()
  }

  async process(job: Job<RiderDispatchJobData>): Promise<void> {
    const { orderId, lng, lat } = job.data
    const isFinalAttempt = job.attemptsMade >= RIDER_DISPATCH_MAX_ATTEMPTS - 1

    const order = await this.ordersService.getOrderById(orderId)
    const stillNeedsRider = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
    ].includes(order.status as OrderStatus)
    if (!stillNeedsRider || order.riderId) {
      this.logger.debug(`Order ${orderId} no longer needs dispatch (status=${order.status}, riderId=${String(order.riderId)})`)
      return
    }

    const customerId = order.customerId.toString()

    // A11: Reset declinedBy at the start of each round so riders from the previous
    // round get a fresh shot. Without this, declinedBy accumulates across all 5 rounds
    // and can exhaust the entire rider pool before max attempts are reached.
    await this.ordersService.clearDeclinedBy(orderId)

    // A12/B1: Geographic cap on dispatch pool — never send a Lagos order to an Abuja
    // rider. Primary search: 50km. Fallback: 100km. No unlimited global fallback.
    let pool = await this.ridersService.findNearbyOnlineVerified(lng, lat, 50_000)
    if (pool.length === 0) {
      pool = await this.ridersService.findNearbyOnlineVerified(lng, lat, 100_000)
    }

    const broadcastTargets = pool.slice(0, 10)
    if (broadcastTargets.length > 0) {
      const userIds = broadcastTargets.map((r) => String(r.userId))
      await this.trackingService.broadcastOrderToRiders(userIds, order)

      // Record this round for dispatch observability metrics.
      void this.ordersService.recordDispatchRound(
        orderId,
        userIds.length,
        job.attemptsMade === 0,
      ).catch(() => undefined)

      // Push notifications — so riders with the app in background/closed still hear the ping.
      void Promise.allSettled(
        userIds.map((userId) =>
          this.notificationsService.send(
            userId,
            NotificationType.RIDER_JOB,
            'New delivery job nearby',
            `Order ${order.orderNumber} is up for grabs. Tap to accept.`,
            { orderId, broadcast: true },
          ).catch(() => undefined),
        ),
      )

      this.trackingService.notifyDispatchUpdate(customerId, orderId, 'broadcast')
      this.logger.warn(`No available riders for order ${orderId} — broadcast to ${userIds.length} online riders (attempt ${job.attemptsMade + 1}/${RIDER_DISPATCH_MAX_ATTEMPTS})`)

      if (isFinalAttempt) {
        // All rounds exhausted — force-assign the nearest online rider as last resort
        const [forceRider] = broadcastTargets
        if (forceRider) {
          try {
            await this.ridersService.assignOrder(forceRider._id.toString(), orderId)
            this.logger.warn(`Force-assigned rider ${String(forceRider._id)} to order ${orderId} after all broadcast rounds`)
            return
          } catch {
            // Rider went offline between broadcast and force-assign — fall through to no_riders
          }
        }
        this.trackingService.notifyDispatchUpdate(customerId, orderId, 'no_riders')
        this.logger.error(`All dispatch rounds exhausted for order ${orderId} — no rider assigned`)
        return
      }

      // Throw so BullMQ retries after the exponential backoff window.
      // This gives broadcast riders time to accept before the next round fires.
      throw new Error(`Broadcast sent to ${userIds.length} riders — waiting for acceptance`)
    }

    // Phase 3 — no riders at all in region
    this.trackingService.notifyDispatchUpdate(customerId, orderId, 'no_riders')
    this.logger.warn(`No riders in region for order ${orderId} — will retry`)
    throw new Error('No riders in region')
  }
}
