import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { FoodCategoryDocument, FoodCategorySchema } from './schemas/food-category.schema'
import { FoodCategoriesService } from './food-categories.service'
import { FoodCategoriesController } from './food-categories.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FoodCategoryDocument.name, schema: FoodCategorySchema },
    ]),
  ],
  controllers: [FoodCategoriesController],
  providers: [FoodCategoriesService],
  exports: [FoodCategoriesService],
})
export class FoodCategoriesModule {}
