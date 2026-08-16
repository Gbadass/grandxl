import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { RestaurantDocument, RestaurantSchema } from './schemas/restaurant.schema'
import { RestaurantsService } from './restaurants.service'
import { RestaurantsController } from './restaurants.controller'
import { AdminRestaurantsController } from './admin-restaurants.controller'
import { UsersModule } from '../users/users.module'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RestaurantDocument.name, schema: RestaurantSchema },
    ]),
    UsersModule,
    EmailModule,
  ],
  controllers: [RestaurantsController, AdminRestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
