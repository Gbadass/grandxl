import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { BannerDocument, BannerSchema } from './schemas/banner.schema'
import { BannersService } from './banners.service'
import { AdminBannersController, PublicBannersController } from './banners.controller'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: BannerDocument.name, schema: BannerSchema }]),
  ],
  controllers: [PublicBannersController, AdminBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
