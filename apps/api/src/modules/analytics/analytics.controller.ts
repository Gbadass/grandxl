import { BadRequestException, Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'

// Tighter per-caller rate limit for analytics — these queries are expensive
// (aggregation pipelines over the full orders collection) and would otherwise
// be scrapeable at the global default of 120/min. 30/min per admin is plenty
// for dashboard refreshes; abnormal patterns get 429.
@ApiTags('Analytics')
@ApiBearerAuth()
@Throttle({ medium: { limit: 30, ttl: 60_000 } })
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

  @Get('restaurant/financial-report')
  @Roles(UserRole.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get financial report for a restaurant (owner only)' })
  @ApiOkResponse({ description: 'Gross/net/fees breakdown + payment-method + cancellations for a date range' })
  @ApiQuery({ name: 'restaurantId', required: true })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (yyyy-mm-dd). Defaults to 30 days before `to`.' })
  @ApiQuery({ name: 'to',   required: false, description: 'ISO date (yyyy-mm-dd). Defaults to today.' })
  async getRestaurantFinancialReport(
    @Query('restaurantId', ParseObjectIdPipe) restaurantId: string,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    try {
      return await this.analyticsService.getRestaurantFinancialReport(restaurantId, from, to)
    } catch (err) {
      // Service throws plain Errors for invalid ranges — convert to a 400 rather
      // than letting them become 500s and paging the on-call.
      if (err instanceof Error && (
        err.message.startsWith('Invalid date range') ||
        err.message.startsWith('Date range too wide')
      )) {
        throw new BadRequestException(err.message)
      }
      throw err
    }
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

  @Get('admin/analytics/order-timeouts')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Order timeout rate (super admin only)' })
  @ApiQuery({ name: 'days', required: false })
  getOrderTimeouts(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getOrderTimeoutMetrics(days)
  }

  @Get('admin/analytics/restaurant-engagement')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Restaurant engagement rate (super admin only)' })
  @ApiQuery({ name: 'days', required: false })
  getRestaurantEngagement(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getRestaurantEngagementMetrics(days)
  }

  @Get('admin/analytics/restaurant-wait-times')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Avg rider dwell time per restaurant (super admin only)' })
  @ApiQuery({ name: 'days', required: false })
  getRestaurantWaitTimes(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getRestaurantWaitTimes(days)
  }

  @Get('admin/analytics/rider-utilization')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rider busy/online ratio (super admin only)' })
  @ApiQuery({ name: 'days', required: false })
  getRiderUtilization(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.analyticsService.getRiderUtilization(days)
  }
}
