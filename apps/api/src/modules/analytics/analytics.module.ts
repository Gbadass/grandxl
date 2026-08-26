import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bullmq'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { RestaurantDocument, RestaurantSchema } from '../restaurants/schemas/restaurant.schema'
import { RiderDocument, RiderSchema } from '../riders/schemas/rider.schema'
import { RiderOnlineSessionDocument, RiderOnlineSessionSchema } from '../riders/schemas/rider-online-session.schema'
import { AnalyticsService } from './analytics.service'
import { AnalyticsController } from './analytics.controller'
import {
  ORDER_TIMEOUT_QUEUE,
  RIDER_DISPATCH_QUEUE,
  SCHEDULED_ORDER_QUEUE,
  SETTLEMENT_QUEUE,
} from '../jobs/constants/queue.constants'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderDocument.name, schema: OrderSchema },
      { name: RestaurantDocument.name, schema: RestaurantSchema },
      { name: RiderDocument.name, schema: RiderSchema },
      { name: RiderOnlineSessionDocument.name, schema: RiderOnlineSessionSchema },
    ]),
    BullModule.registerQueue(
      { name: ORDER_TIMEOUT_QUEUE },
      { name: RIDER_DISPATCH_QUEUE },
      { name: SCHEDULED_ORDER_QUEUE },
      { name: SETTLEMENT_QUEUE },
    ),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
