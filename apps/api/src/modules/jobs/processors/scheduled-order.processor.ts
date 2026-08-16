import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { SCHEDULED_ORDER_QUEUE } from '../constants/queue.constants'
import { OrdersService } from '../../orders/orders.service'

export interface ScheduledOrderJobData {
  orderId: string
}

// Fires `scheduledFor - prep buffer` minutes after the order was placed.
// Handler releases the order to the restaurant (live queue, notifications, etc.)
@Processor(SCHEDULED_ORDER_QUEUE)
export class ScheduledOrderProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledOrderProcessor.name)

  constructor(private readonly ordersService: OrdersService) {
    super()
  }

  async process(job: Job<ScheduledOrderJobData>): Promise<void> {
    this.logger.debug(`Releasing scheduled order ${job.data.orderId}`)
    await this.ordersService.releaseScheduledOrder(job.data.orderId)
  }
}
