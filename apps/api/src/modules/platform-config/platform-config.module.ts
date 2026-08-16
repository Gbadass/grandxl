import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PlatformConfigDocument, PlatformConfigSchema } from './schemas/platform-config.schema'
import { CouponDocument, CouponSchema } from './schemas/coupon.schema'
import { PlatformConfigService } from './platform-config.service'
import { PlatformConfigController } from './platform-config.controller'
import { CouponsController } from './coupons.controller'
import { RestaurantCouponsController } from './restaurant-coupons.controller'
import { RestaurantsModule } from '../restaurants/restaurants.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlatformConfigDocument.name, schema: PlatformConfigSchema },
      { name: CouponDocument.name, schema: CouponSchema },
    ]),
    // Owner-coupon controller resolves the caller's restaurant via RestaurantsService.
    RestaurantsModule,
  ],
  controllers: [PlatformConfigController, CouponsController, RestaurantCouponsController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
