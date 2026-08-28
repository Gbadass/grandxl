import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { DISPATCH_ESCALATION_QUEUE } from '../constants/queue.constants'
import { OrdersService } from '../../orders/orders.service'

export interface DispatchEscalationJobData {
  orderId: string
  lat:     number
  lng:     number
}

// S-URGENT (Nigerian ack flow): fires 90s after payment-complete if the
// restaurant hasn't engaged with the order (Accept / Ready / Reject). Marks
// `dispatchedWithoutRestaurantAck: true` on the order for ops visibility, then
// fires the actual rider dispatch. Restaurant Accept cancels this job via
// queue.remove(`escalation-{orderId}`) before it fires.
@Processor(DISPATCH_ESCALATION_QUEUE)
export class DispatchEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchEscalationProcessor.name)

  constructor(private readonly ordersService: OrdersService) {
    super()
  }

  async process(job: Job<DispatchEscalationJobData>): Promise<void> {
    const { orderId, lat, lng } = job.data
    this.logger.log(`Escalation firing for order ${orderId} — restaurant did not engage in 90s`)
    await this.ordersService.escalateDispatchIfNeeded(orderId, lat, lng)
  }
}
