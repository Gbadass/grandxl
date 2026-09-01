import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserDocument, UserSchema } from '../users/schemas/user.schema'
import { TransactionDocument, TransactionSchema } from '../payments/schemas/transaction.schema'
import { RefundRequestDocument, RefundRequestSchema } from '../refunds/schemas/refund-request.schema'
import { FraudService } from './fraud.service'
import { AdminFraudController } from './admin-fraud.controller'
import { UsersModule } from '../users/users.module'

// Global so any module can inject FraudService without re-importing.
// UsersModule imported (not forwardRef — no cycle, since UsersModule doesn't
// import FraudModule; it just uses the globally-provided FraudService).
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name,           schema: UserSchema },
      { name: TransactionDocument.name,    schema: TransactionSchema },
      { name: RefundRequestDocument.name,  schema: RefundRequestSchema },
    ]),
    UsersModule,
  ],
  controllers: [AdminFraudController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
