import { forwardRef, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { TransactionDocument, TransactionSchema } from './schemas/transaction.schema'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { OrdersModule } from '../orders/orders.module'
import { UsersModule } from '../users/users.module'
import { WalletModule } from '../wallet/wallet.module'
import { FraudModule } from '../fraud/fraud.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TransactionDocument.name, schema: TransactionSchema },
    ]),
    forwardRef(() => OrdersModule),
    UsersModule,
    forwardRef(() => WalletModule),
    FraudModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
