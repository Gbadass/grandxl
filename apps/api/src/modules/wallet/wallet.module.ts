import { forwardRef, Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WalletDocument, WalletSchema } from './schemas/wallet.schema'
import { WalletTransactionDocument, WalletTransactionSchema } from './schemas/wallet-transaction.schema'
import { WalletService } from './wallet.service'
import { WalletController } from './wallet.controller'
import { PaymentsModule } from '../payments/payments.module'

// Global so refund + order + admin modules can credit/debit without re-importing.
// PaymentsModule -> WalletModule (uses credit on top-up webhook); WalletController -> PaymentsModule.
// forwardRef breaks the resulting cycle.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletDocument.name,            schema: WalletSchema },
      { name: WalletTransactionDocument.name, schema: WalletTransactionSchema },
    ]),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
