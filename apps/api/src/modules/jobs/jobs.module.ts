import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { OrdersModule } from '../orders/orders.module'
import { RidersModule } from '../riders/riders.module'
import { RestaurantsModule } from '../restaurants/restaurants.module'
import { TrackingModule } from '../tracking/tracking.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { OrderTimeoutProcessor } from './processors/order-timeout.processor'
import { RiderDispatchProcessor } from './processors/rider-dispatch.processor'
import { ScheduledOrderProcessor } from './processors/scheduled-order.processor'
import { SettlementProcessor } from './processors/settlement.processor'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  SETTLEMENT_QUEUE,
  RIDER_DISPATCH_BACKOFF_BASE_MS,
  RIDER_DISPATCH_MAX_ATTEMPTS,
} from './constants/queue.constants'

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: ORDER_TIMEOUT_QUEUE,
        defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: 50 },
      },
      {
        name: RIDER_DISPATCH_QUEUE,
        defaultJobOptions: {
          attempts: RIDER_DISPATCH_MAX_ATTEMPTS,
          backoff: { type: 'exponential', delay: RIDER_DISPATCH_BACKOFF_BASE_MS },
          removeOnComplete: true,
          removeOnFail: 100, // keep more for debugging dispatch failures
        },
      },
      {
        name: SCHEDULED_ORDER_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'fixed', delay: 10_000 },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      },
      {
        name: SETTLEMENT_QUEUE,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'fixed', delay: 60_000 }, // 1min between retries for nightly batch
          removeOnComplete: 30,
          removeOnFail: 50,
        },
      },
    ),
    OrdersModule,
    RidersModule,
    RestaurantsModule,
    TrackingModule,
    NotificationsModule,
  ],
  providers: [OrderTimeoutProcessor, RiderDispatchProcessor, ScheduledOrderProcessor, SettlementProcessor],
})
export class JobsModule {}
