import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger'
import type { Request } from 'express'
import { RidersService } from './riders.service'
import { AuditService } from '../audit/audit.service'
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
