import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule } from '@nestjs/config'
import {
  PayoutRequestDocument,
  PayoutRequestSchema,
} from './schemas/payout-request.schema'
import {
  RiderDocument,
  RiderSchema,
} from '../riders/schemas/rider.schema'
import { PayoutsService } from './payouts.service'
import {
  AdminPayoutsController,
  PaystackWebhookController,
  RiderPayoutsController,
} from './payouts.controller'

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PayoutRequestDocument.name, schema: PayoutRequestSchema },
      { name: RiderDocument.name,         schema: RiderSchema },
    ]),
  ],
  controllers: [RiderPayoutsController, AdminPayoutsController, PaystackWebhookController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
