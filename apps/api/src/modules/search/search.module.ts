import { Module } from '@nestjs/common'
import { RestaurantsModule } from '../restaurants/restaurants.module'
import { MenuItemsModule } from '../menu-items/menu-items.module'
import { SearchService } from './search.service'
import { SearchController } from './search.controller'

@Module({
  imports: [RestaurantsModule, MenuItemsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
