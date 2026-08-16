import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { ORDER_TIMEOUT_QUEUE } from '../constants/queue.constants'
import { OrdersService } from '../../orders/orders.service'

export interface OrderTimeoutJobData {
  orderId: string
}

@Processor(ORDER_TIMEOUT_QUEUE)
export class OrderTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderTimeoutProcessor.name)

  constructor(private readonly ordersService: OrdersService) {
    super()
  }

  async process(job: Job<OrderTimeoutJobData>): Promise<void> {
    this.logger.debug(`Checking timeout for order ${job.data.orderId}`)
    await this.ordersService.cancelIfTimedOut(job.data.orderId)
  }
}
