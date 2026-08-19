import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('admin/analytics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get platform-wide analytics (super admin only)' })
  @ApiOkResponse({ description: 'Platform analytics summary' })
  getPlatformAnalytics() {
    return this.analyticsService.getPlatformAnalytics()
  }

  @Get('restaurant/analytics')
  @Roles(UserRole.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get analytics for a specific restaurant (owner only)' })
  @ApiOkResponse({ description: 'Restaurant analytics summary' })
  getRestaurantAnalytics(
    @Query('restaurantId', ParseObjectIdPipe) restaurantId: string,
  ) {
    return this.analyticsService.getRestaurantAnalytics(restaurantId)
  }
}
