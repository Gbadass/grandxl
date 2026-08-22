import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { DisputeDocument, DisputeSchema } from './schemas/dispute.schema'
import { DisputesService } from './disputes.service'
import { DisputesController } from './disputes.controller'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DisputeDocument.name, schema: DisputeSchema },
    ]),
    OrdersModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
