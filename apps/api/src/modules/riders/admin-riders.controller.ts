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
} from '@nestjs/swagger'
import type { Request } from 'express'
import { RidersService } from './riders.service'
import { AuditService } from '../audit/audit.service'
import { AdminOnboardRiderDto } from './dto/admin-onboard-rider.dto'
import { SuspendRiderDto } from './dto/suspend-rider.dto'
import { TerminateRiderDto } from './dto/terminate-rider.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Riders')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/riders')
export class AdminRidersController {
  constructor(
    private readonly ridersService: RidersService,
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
  @ApiOperation({ summary: 'Admin onboards a rider directly — creates pre-verified account on behalf of existing or new user' })
  @ApiCreatedResponse({ description: 'Rider created and verified' })
  async onboard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminOnboardRiderDto,
    @Req() req: Request,
  ) {
    const result = await this.ridersService.adminOnboard(dto, user.sub)
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'rider.admin_onboard',
      targetType: 'rider',
      targetId:   String(result._id),
      metadata:   { phone: dto.riderPhone, vehicleType: dto.vehicleType },
    })
    return result
  }

  @Get()
  @ApiOperation({ summary: 'List all riders (admin)' })
  @ApiOkResponse({ description: 'Paginated rider list' })
  async listRiders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ridersService.listRiders(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rider by ID (admin)' })
  @ApiOkResponse({ description: 'Rider profile' })
  async getRider(@Param('id', ParseObjectIdPipe) id: string) {
    return this.ridersService.getProfileById(id)
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a rider — allows them to accept jobs' })
  @ApiOkResponse({ description: 'Rider verified' })
  async verifyRider(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const result = await this.ridersService.verifyRider(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'rider.verify', targetType: 'rider', targetId: id })
    return result
  }

  @Patch(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a rider — blocks them from accepting jobs' })
  @ApiOkResponse({ description: 'Rider suspended' })
  async suspendRider(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SuspendRiderDto,
    @Req() req: Request,
  ) {
    const result = await this.ridersService.suspendRider(id, dto)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'rider.suspend', targetType: 'rider', targetId: id, metadata: { reason: dto.reason } })
    return result
  }

  @Patch(':id/reinstate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reinstate a suspended rider' })
  @ApiOkResponse({ description: 'Rider reinstated' })
  async reinstateRider(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: Request,
  ) {
    const result = await this.ridersService.reinstateRider(id)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'rider.reinstate', targetType: 'rider', targetId: id })
    return result
  }

  @Patch(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently terminate a rider account' })
  @ApiOkResponse({ description: 'Rider terminated' })
  async terminateRider(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: TerminateRiderDto,
    @Req() req: Request,
  ) {
    const result = await this.ridersService.terminateRider(id, dto)
    void this.audit.log({ ...this.auditMeta(req, user), action: 'rider.terminate', targetType: 'rider', targetId: id, metadata: { reason: dto.reason } })
    return result
  }

  @Post(':riderId/assign/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually assign a rider to an order' })
  @ApiOkResponse({ description: 'Rider assigned' })
  async assignOrder(
    @CurrentUser() user: JwtPayload,
    @Param('riderId', ParseObjectIdPipe) riderId: string,
    @Param('orderId', ParseObjectIdPipe) orderId: string,
    @Req() req: Request,
  ) {
    await this.ridersService.assignOrder(riderId, orderId)
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'rider.manual_assign',
      targetType: 'order',
      targetId:   orderId,
      metadata:   { riderId },
    })
    return { assigned: true }
  }
}
