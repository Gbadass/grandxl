import { Body, Controller, Get, Post, Delete, Param, Query, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import type { Request } from 'express'
import { OrdersService } from './orders.service'
import { QueryOrdersDto } from './dto/query-orders.dto'
import { ReassignRiderDto } from './dto/reassign-rider.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { AuditService } from '../audit/audit.service'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Orders')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ApiOkResponse({ description: 'Paginated order list' })
  async getAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.getAdminOrders(query)
  }

  @Delete('all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System-wide order clear — hides all orders from every view (soft-delete)' })
  @ApiOkResponse({ description: 'Number of orders cleared' })
  async clearAll(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const result = await this.ordersService.clearAllOrders()
    void this.audit.log({
      actorId:    user.sub,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent:  req.headers['user-agent'],
      action:     'orders.clear_all',
      targetType: 'orders_collection',
      targetId:   'all',
      metadata:   { clearedCount: result.cleared },
    })
    return result
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any order by ID (admin, enriched with customer/restaurant/rider)' })
  @ApiOkResponse({ description: 'Order details with joined participant data' })
  async getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.getAdminOrderById(id)
  }

  @Post(':id/redispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-queue rider dispatch for a stuck order — clears declinedBy and fires a fresh dispatch job' })
  @ApiOkResponse({ description: 'Dispatch re-queued' })
  async redispatch(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    await this.ordersService.adminRedispatch(id)
    void this.audit.log({
      actorId:    user.sub,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent:  req.headers['user-agent'],
      action:     'orders.redispatch',
      targetType: 'order',
      targetId:   id,
      metadata:   {},
    })
    return { message: 'Dispatch re-queued' }
  }

  @Get(':id/dispatch-debug')
  @ApiOperation({ summary: 'Debug dispatch — shows what riders the processor would find right now' })
  async dispatchDebug(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.dispatchDebug(id)
  }

  @Get(':id/reassign-candidates')
  @ApiOperation({ summary: 'List available riders (sorted by distance to pickup) for reassigning this order' })
  @ApiOkResponse({ description: 'Array of candidate riders with distanceKm' })
  async reassignCandidates(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ordersService.getReassignCandidates(id, 20)
  }

  @Post(':id/reassign-rider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign an in-flight order to a specific rider (super-admin live-ops)' })
  @ApiOkResponse({ description: 'Reassigned order' })
  async reassignRider(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ReassignRiderDto,
    @Req() req: Request,
  ) {
    const result = await this.ordersService.adminReassignRider(id, dto.riderId)
    void this.audit.log({
      actorId:    user.sub,
      ipAddress:  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent:  req.headers['user-agent'],
      action:     'orders.reassign_rider',
      targetType: 'order',
      targetId:   id,
      metadata:   {
        newRiderId: dto.riderId,
        reason: dto.reason ?? null,
      },
    })
    return result
  }
}
