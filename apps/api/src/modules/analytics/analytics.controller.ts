import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
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

  @Get('admin/analytics/dispatch')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Dispatch observability metrics (super admin only)' })
  @ApiOkResponse({ description: 'Avg wait time, rounds, force-assign rate, no-rider rate' })
  @ApiQuery({ name: 'days', required: false, description: 'Lookback window in days (default 7)' })
  getDispatchMetrics(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getDispatchMetrics(days)
  }

  @Get('admin/analytics/queue-depth')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'BullMQ queue depth snapshot (super admin only)' })
  @ApiOkResponse({ description: 'Waiting/active/delayed/failed counts per queue' })
  getQueueDepth() {
    return this.analyticsService.getQueueDepth()
  }

  @Get('admin/analytics/heatmap')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Order delivery heatmap (super admin only)' })
  @ApiOkResponse({ description: 'Clustered lat/lng/count points for map rendering' })
  @ApiQuery({ name: 'days', required: false, description: 'Lookback window in days (default 30)' })
  getOrderHeatmap(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getOrderHeatmap(days)
  }
}
