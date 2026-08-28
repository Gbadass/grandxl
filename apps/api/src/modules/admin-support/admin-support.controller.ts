import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import type { Request } from 'express'
import { AdminSupportService } from './admin-support.service'
import { ForceRefundDto, EmergencyCreditDto } from './dto/support.dto'
import { AuditService } from '../audit/audit.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Admin — Support')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/support')
export class AdminSupportController {
  constructor(
    private readonly support: AdminSupportService,
    private readonly audit:   AuditService,
  ) {}

  private auditMeta(req: Request, user: JwtPayload) {
    return {
      actorId:   user.sub,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
    }
  }

  @Post('force-refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force a wallet refund on any order (super-admin live-ops)' })
  @ApiOkResponse({ description: '{ orderId, refundedKobo, balanceAfter }' })
  async forceRefund(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ForceRefundDto,
    @Req() req: Request,
  ) {
    const result = await this.support.forceRefund({
      orderId:    dto.orderId,
      amountKobo: dto.amountKobo,
      reason:     dto.reason,
    })
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'support.force_refund',
      targetType: 'order',
      targetId:   dto.orderId,
      metadata:   { amountKobo: result.refundedKobo, reason: dto.reason },
    })
    return result
  }

  @Post('emergency-credit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant a goodwill wallet credit to a customer (super-admin live-ops)' })
  @ApiOkResponse({ description: '{ userId, creditedKobo, balanceAfter }' })
  async emergencyCredit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: EmergencyCreditDto,
    @Req() req: Request,
  ) {
    const result = await this.support.emergencyCredit({
      userId:     dto.userId,
      amountKobo: dto.amountKobo,
      reason:     dto.reason,
    })
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'support.emergency_credit',
      targetType: 'user',
      targetId:   dto.userId,
      metadata:   { amountKobo: dto.amountKobo, reason: dto.reason },
    })
    return result
  }
}
