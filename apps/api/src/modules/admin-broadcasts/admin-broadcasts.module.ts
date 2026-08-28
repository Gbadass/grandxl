import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AdminBroadcastsService } from './admin-broadcasts.service'
import { AdminBroadcastsController } from './admin-broadcasts.controller'
import { BroadcastDocument, BroadcastSchema } from './schemas/broadcast.schema'
import { UsersModule } from '../users/users.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AuditModule } from '../audit/audit.module'

// Sprint 13 (S13-8): admin-initiated system announcements. Fans out via the
// existing NotificationsService per-recipient pipeline; each recipient still
// gets the in-app row + socket + push exactly like a business-event notification.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: BroadcastDocument.name, schema: BroadcastSchema }]),
    UsersModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AdminBroadcastsController],
  providers: [AdminBroadcastsService],
})
export class AdminBroadcastsModule {}
