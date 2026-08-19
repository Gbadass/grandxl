import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TrackingGateway } from './tracking.gateway'
import { TrackingService } from './tracking.service'
import { OrderDocument, OrderSchema } from '../orders/schemas/order.schema'

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    // Lean read of order participants — bypasses OrdersService to avoid circular dep
    MongooseModule.forFeature([{ name: OrderDocument.name, schema: OrderSchema }]),
  ],
  providers: [TrackingGateway, TrackingService],
  exports: [TrackingGateway, TrackingService],
})
export class TrackingModule {}
