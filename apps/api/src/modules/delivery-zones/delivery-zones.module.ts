import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { DeliveryZoneDocument, DeliveryZoneSchema } from './schemas/delivery-zone.schema'
import { DeliveryZonesService } from './delivery-zones.service'
import { DeliveryZonesController } from './delivery-zones.controller'

// Global so OrdersService can look up zone for a point without re-importing.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeliveryZoneDocument.name, schema: DeliveryZoneSchema },
    ]),
  ],
  controllers: [DeliveryZonesController],
  providers: [DeliveryZonesService],
  exports: [DeliveryZonesService],
})
export class DeliveryZonesModule {}
