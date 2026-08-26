import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RiderDocument, RiderSchema } from './schemas/rider.schema'
import { RiderOnlineSessionDocument, RiderOnlineSessionSchema } from './schemas/rider-online-session.schema'
import { RidersService } from './riders.service'
import { RidersController } from './riders.controller'
import { AdminRidersController } from './admin-riders.controller'
import { OrdersModule } from '../orders/orders.module'
import { UsersModule } from '../users/users.module'
import { AuthModule } from '../auth/auth.module'
import { EmailModule } from '../email/email.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RiderDocument.name, schema: RiderSchema },
      { name: RiderOnlineSessionDocument.name, schema: RiderOnlineSessionSchema },
    ]),
    forwardRef(() => OrdersModule),
    UsersModule,
    AuthModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [RidersController, AdminRidersController],
  providers: [RidersService],
  exports: [RidersService],
})
export class RidersModule {}
