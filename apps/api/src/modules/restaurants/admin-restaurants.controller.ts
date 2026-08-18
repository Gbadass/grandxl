import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger'
import type { Request } from 'express'
import { RestaurantsService } from './restaurants.service'
import { RejectRestaurantDto, SuspendRestaurantDto, RequestMoreInfoDto, AdminOnboardRestaurantDto } from './dto/admin-action.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { AuditService } from '../audit/audit.service'
import { UserRole, RestaurantApprovalStatus } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Restaurants')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/restaurants')
export class AdminRestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly audit: AuditService,
  ) {}

  private auditMeta(req: Request, user: JwtPayload) {
    return {
      actorId:   user.sub,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admin onboards a restaurant directly — creates pre-approved on behalf of existing user' })
  @ApiCreatedResponse({ description: 'Restaurant created and approved' })
  async onboard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminOnboardRestaurantDto,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.adminOnboard(dto, user.sub)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.admin_onboard', targetType: 'restaurant', targetId: result._id.toString(), metadata: { name: dto.name, ownerPhone: dto.ownerPhone } })
    return result
  }

  @Get()
  @ApiOperation({ summary: 'List all restaurants — filterable by approval status' })
  @ApiQuery({ name: 'status', enum: RestaurantApprovalStatus, required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ description: 'Paginated list of all restaurants with full details' })
  async findAll(
    @Query('status') status?: RestaurantApprovalStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.restaurantsService.findAllAdmin(status, Number(page), Number(limit))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full restaurant details including bank info' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.restaurantsService.findByIdLean(id)
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a restaurant — makes it visible to customers' })
  @ApiOkResponse({ description: 'Restaurant approved' })
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.approve(id, user.sub)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.approve', targetType: 'restaurant', targetId: id })
    return result
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a restaurant application with a reason' })
  @ApiOkResponse({ description: 'Restaurant rejected' })
  async reject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectRestaurantDto,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.reject(id, dto.reason)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.reject', targetType: 'restaurant', targetId: id, metadata: { reason: dto.reason } })
    return result
  }

  @Patch(':id/request-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request additional information from the restaurant owner' })
  @ApiOkResponse({ description: 'Info request saved — owner will be notified' })
  async requestInfo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RequestMoreInfoDto,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.requestMoreInfo(id, dto.message)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.request_info', targetType: 'restaurant', targetId: id, metadata: { message: dto.message } })
    return result
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an approved restaurant — hides it from customers immediately' })
  @ApiOkResponse({ description: 'Restaurant suspended' })
  async suspend(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SuspendRestaurantDto,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.suspend(id, dto.reason)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.suspend', targetType: 'restaurant', targetId: id, metadata: { reason: dto.reason } })
    return result
  }

  @Patch(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reinstate a suspended restaurant' })
  @ApiOkResponse({ description: 'Restaurant reinstated' })
  async reinstate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const result = await this.restaurantsService.reinstate(id, user.sub)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'restaurant.reinstate', targetType: 'restaurant', targetId: id })
    return result
  }
}
