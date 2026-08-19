import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { RestaurantDocument, RestaurantSchema } from '../restaurants/schemas/restaurant.schema'
import { RiderDocument, RiderSchema } from '../riders/schemas/rider.schema'
import { AnalyticsService } from './analytics.service'
import { AnalyticsController } from './analytics.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderDocument.name, schema: OrderSchema },
      { name: RestaurantDocument.name, schema: RestaurantSchema },
      { name: RiderDocument.name, schema: RiderSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
