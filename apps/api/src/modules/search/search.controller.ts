import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { SearchService } from './search.service'
import { SearchQueryDto } from './dto/search-query.dto'
import { Public } from '../../common/decorators/public.decorator'

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Full-text search across restaurants and menu items' })
  @ApiOkResponse({ description: 'Matched restaurants and menu items sorted by relevance' })
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query)
  }

  @Get('autocomplete')
  @Public()
  @ApiOperation({ summary: 'Restaurant name autocomplete for search-as-you-type' })
  @ApiOkResponse({ description: 'Up to 8 matching restaurant names' })
  @ApiQuery({ name: 'q', required: true, example: 'chi' })
  @ApiQuery({ name: 'country', required: false, example: 'NG' })
  async autocomplete(
    @Query('q') q: string,
    @Query('country') country?: string,
  ) {
    if (!q || q.length < 1) return []
    return this.searchService.autocomplete(q, country)
  }
}
