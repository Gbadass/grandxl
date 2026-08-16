import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UserDocument, UserSchema } from '../users/schemas/user.schema'
import { TransactionDocument, TransactionSchema } from '../payments/schemas/transaction.schema'
import { RefundRequestDocument, RefundRequestSchema } from '../refunds/schemas/refund-request.schema'
import { FraudService } from './fraud.service'

// Global so any module can inject FraudService without re-importing.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserDocument.name,           schema: UserSchema },
      { name: TransactionDocument.name,    schema: TransactionSchema },
      { name: RefundRequestDocument.name,  schema: RefundRequestSchema },
    ]),
  ],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
