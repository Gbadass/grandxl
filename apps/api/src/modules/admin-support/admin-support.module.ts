import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AdminSupportService } from './admin-support.service'
import { AdminSupportController } from './admin-support.controller'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { UsersModule } from '../users/users.module'
import { WalletModule } from '../wallet/wallet.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AuditModule } from '../audit/audit.module'

// Sprint 13 (S13-5): admin-initiated support actions (force refund + goodwill
// credit). Deliberately a separate module — orders/refunds already own the
// customer-initiated flows and shouldn't grow admin-only paths that muddle
// the concerns.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: OrderDocument.name, schema: OrderSchema }]),
    UsersModule,
    WalletModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
})
export class AdminSupportModule {}
