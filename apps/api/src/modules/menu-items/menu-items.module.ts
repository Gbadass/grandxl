import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MenuCategoryDocument, MenuCategorySchema } from './schemas/menu-category.schema'
import { MenuItemDocument, MenuItemSchema } from './schemas/menu-item.schema'
import { MenuItemsService } from './menu-items.service'
import { MenuItemsController } from './menu-items.controller'
import { RestaurantsModule } from '../restaurants/restaurants.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MenuCategoryDocument.name, schema: MenuCategorySchema },
      { name: MenuItemDocument.name, schema: MenuItemSchema },
    ]),
    RestaurantsModule,
  ],
  controllers: [MenuItemsController],
  providers: [MenuItemsService],
  exports: [MenuItemsService],
})
export class MenuItemsModule {}
