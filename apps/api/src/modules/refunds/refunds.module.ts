import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RefundRequestDocument, RefundRequestSchema } from './schemas/refund-request.schema'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'
import { RefundsService } from './refunds.service'
import { RefundsController, AdminRefundsController } from './refunds.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefundRequestDocument.name, schema: RefundRequestSchema },
      { name: OrderDocument.name,         schema: OrderSchema },
    ]),
  ],
  controllers: [RefundsController, AdminRefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
