import { Module, forwardRef } from '@nestjs/common'
import { ReferralsModule } from '../referrals/referrals.module'
import { MongooseModule } from '@nestjs/mongoose'
import { BullModule } from '@nestjs/bullmq'
import { OrderDocument, OrderSchema } from './schemas/order.schema'
import { CounterDocument, CounterSchema } from './schemas/counter.schema'
import { OrdersService } from './orders.service'
import { SettlementService } from './settlement.service'
import { OrdersController } from './orders.controller'
import { AdminOrdersController } from './admin-orders.controller'
import { RidersModule } from '../riders/riders.module'
import { MenuItemsModule } from '../menu-items/menu-items.module'
import { RestaurantsModule } from '../restaurants/restaurants.module'
import { TrackingModule } from '../tracking/tracking.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { PlatformConfigModule } from '../platform-config/platform-config.module'
import { PaymentsModule } from '../payments/payments.module'
import { ORDER_TIMEOUT_QUEUE, RIDER_DISPATCH_QUEUE, SCHEDULED_ORDER_QUEUE } from '../jobs/constants/queue.constants'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderDocument.name, schema: OrderSchema },
      { name: CounterDocument.name, schema: CounterSchema },
    ]),
    BullModule.registerQueue(
      { name: ORDER_TIMEOUT_QUEUE },
      { name: RIDER_DISPATCH_QUEUE },
      { name: SCHEDULED_ORDER_QUEUE },
    ),
    forwardRef(() => RidersModule),
    forwardRef(() => PaymentsModule),
    MenuItemsModule,
    RestaurantsModule,
    TrackingModule,
    NotificationsModule,
    PlatformConfigModule,
    ReferralsModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, SettlementService],
  exports: [OrdersService, SettlementService],
})
export class OrdersModule {}
