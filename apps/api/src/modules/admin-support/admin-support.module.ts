import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AdminSupportService } from './admin-support.service'
import { AdminSupportController } from './admin-support.controller'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { DisputeDocument, DisputeSchema } from '../disputes/schemas/dispute.schema'
import { RefundRequestDocument, RefundRequestSchema } from '../refunds/schemas/refund-request.schema'
import { UserDocument, UserSchema } from '../users/schemas/user.schema'
import { UsersModule } from '../users/users.module'
import { WalletModule } from '../wallet/wallet.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AuditModule } from '../audit/audit.module'

// Sprint 13 (S13-5, S13-14): admin-initiated support actions. Started as
// force-refund + emergency-credit; grew customer-lookup/overview/contact for
// the /support triage page. Deliberately a separate module — orders/refunds
// already own the customer-initiated flows and shouldn't grow admin-only
// paths that muddle the concerns.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderDocument.name,         schema: OrderSchema },
      { name: DisputeDocument.name,       schema: DisputeSchema },
      { name: RefundRequestDocument.name, schema: RefundRequestSchema },
      { name: UserDocument.name,          schema: UserSchema },
    ]),
    UsersModule,
    WalletModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AdminSupportController],
  providers: [AdminSupportService],
})
export class AdminSupportModule {}
