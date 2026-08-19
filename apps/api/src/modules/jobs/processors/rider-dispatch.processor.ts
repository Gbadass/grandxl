import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RIDER_DISPATCH_QUEUE } from '../constants/queue.constants'
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

    // Phase 1 — auto-assign a nearby available rider
    const available = await this.ridersService.findNearestAvailable(lng, lat)
    if (available.length > 0) {
      await this.ridersService.assignOrder(available[0]._id.toString(), orderId)
      this.logger.debug(`Auto-assigned rider ${String(available[0]._id)} to order ${orderId}`)
      return
    }

    // Phase 2 — no available riders: broadcast to nearest online+verified riders.
    // Cap at 10 to avoid a thundering-herd notification storm; the closest riders
    // are most likely to accept and arrive fastest anyway.
    const customerId = order.customerId.toString()
    const nearby = await this.ridersService.findNearbyOnlineVerified(lng, lat)
    const broadcastTargets = nearby.slice(0, 10)
    if (broadcastTargets.length > 0) {
      const userIds = broadcastTargets.map((r) => String(r.userId))
      this.trackingService.broadcastOrderToRiders(userIds, order)

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

      // Tell the customer we're expanding the search
      this.trackingService.notifyDispatchUpdate(customerId, orderId, 'broadcast')
      this.logger.warn(`No available riders for order ${orderId} — broadcast to ${userIds.length} online riders`)
      return
    }

    // Phase 3 — no riders at all in region; retry
    this.trackingService.notifyDispatchUpdate(customerId, orderId, 'no_riders')
    this.logger.warn(`No riders in region for order ${orderId} — will retry`)
    throw new Error('No riders in region')
  }
}
