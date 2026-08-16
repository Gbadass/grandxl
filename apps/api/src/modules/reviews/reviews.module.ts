import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ReviewDocument, ReviewSchema } from './schemas/review.schema'
import { ReviewsService } from './reviews.service'
import { ReviewsController } from './reviews.controller'
import { AdminReviewsController } from './admin-reviews.controller'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReviewDocument.name, schema: ReviewSchema },
    ]),
    OrdersModule,
  ],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
