import { Injectable } from '@nestjs/common'
import { RestaurantsService } from '../restaurants/restaurants.service'
import { MenuItemsService } from '../menu-items/menu-items.service'
import type { RestaurantDocument } from '../restaurants/schemas/restaurant.schema'
import type { MenuItemDocument } from '../menu-items/schemas/menu-item.schema'
import type { SearchQueryDto } from './dto/search-query.dto'

export interface SearchResults {
  restaurants: RestaurantDocument[]
  menuItems: MenuItemDocument[]
  meta: {
    query: string
    restaurantCount: number
    menuItemCount: number
    page: number
    limit: number
  }
}

@Injectable()
export class SearchService {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly menuItemsService: MenuItemsService,
  ) {}

  async search(dto: SearchQueryDto): Promise<SearchResults> {
    const page = dto.page ?? 1
    const limit = dto.limit ?? 20

    const [restaurants, menuItems] = await Promise.all([
      this.restaurantsService.searchByText(dto.q, page, limit, dto.country),
      this.menuItemsService.searchByText(dto.q, page, limit),
    ])

    return {
      restaurants,
      menuItems,
      meta: {
        query: dto.q,
        restaurantCount: restaurants.length,
        menuItemCount: menuItems.length,
        page,
        limit,
      },
    }
  }

  async autocomplete(
    q: string,
    country?: string,
    limit = 8,
  ): Promise<{ _id: string; name: string; slug: string; logo: string | null }[]> {
    return this.restaurantsService.autocompleteByName(q, limit, country)
  }
}
