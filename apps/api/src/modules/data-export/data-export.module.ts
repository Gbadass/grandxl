import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserDocument, UserSchema } from '../users/schemas/user.schema'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { RefundRequestDocument, RefundRequestSchema } from '../refunds/schemas/refund-request.schema'
import { WalletTransactionDocument, WalletTransactionSchema } from '../wallet/schemas/wallet-transaction.schema'
import { NotificationDocument, NotificationSchema } from '../notifications/schemas/notification.schema'
import { RiderDocument, RiderSchema } from '../riders/schemas/rider.schema'
import { PayoutRequestDocument, PayoutRequestSchema } from '../payouts/schemas/payout-request.schema'
import { AuditLogDocument, AuditLogSchema } from '../audit/schemas/audit-log.schema'
import { DataExportService } from './data-export.service'

// Global — the UsersController injects DataExportService directly for the
// /users/me/data-export endpoint.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name,               schema: UserSchema },
      { name: OrderDocument.name,              schema: OrderSchema },
      { name: RefundRequestDocument.name,      schema: RefundRequestSchema },
      { name: WalletTransactionDocument.name,  schema: WalletTransactionSchema },
      { name: NotificationDocument.name,       schema: NotificationSchema },
      { name: RiderDocument.name,              schema: RiderSchema },
      { name: PayoutRequestDocument.name,      schema: PayoutRequestSchema },
      { name: AuditLogDocument.name,           schema: AuditLogSchema },
    ]),
  ],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class DataExportModule {}
