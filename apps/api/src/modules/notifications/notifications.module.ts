import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { NotificationDocument, NotificationSchema } from './schemas/notification.schema'
import { PushProvider } from './push.provider'
import { WebPushProvider } from './web-push.provider'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { UsersModule } from '../users/users.module'
import { TermiiProvider } from '../auth/providers/termii.provider'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationDocument.name, schema: NotificationSchema },
    ]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [PushProvider, WebPushProvider, NotificationsService, TermiiProvider],
  exports: [NotificationsService, PushProvider, WebPushProvider],
})
export class NotificationsModule {}
