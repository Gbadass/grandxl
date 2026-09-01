import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RiderDocument, RiderSchema } from './schemas/rider.schema'
import { RiderOnlineSessionDocument, RiderOnlineSessionSchema } from './schemas/rider-online-session.schema'
import { RidersService } from './riders.service'
import { StaleSessionSweeperService } from './stale-session-sweeper.service'
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
    // S13-13: UsersModule now imports RidersModule via forwardRef (for the
    // blocklist controller) so we mirror the forwardRef here to break the cycle.
    forwardRef(() => UsersModule),
    AuthModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [RidersController, AdminRidersController],
  providers: [RidersService, StaleSessionSweeperService],
  exports: [RidersService],
})
export class RidersModule {}
