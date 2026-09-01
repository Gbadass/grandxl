import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger'
import type { Request } from 'express'
import { AdminSupportService } from './admin-support.service'
import { ForceRefundDto, EmergencyCreditDto, ContactCustomerDto } from './dto/support.dto'
import { AuditService } from '../audit/audit.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
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

  // ── S13-14 ─────────────────────────────────────────────────────────

  @Get('customer-lookup')
  @ApiOperation({ summary: 'Search customers by phone/email/name (+ order shortId)' })
  @ApiOkResponse({ description: 'Array of matching customer summaries' })
  async customerLookup(@Query('q') q?: string) {
    return this.support.lookupCustomers(q ?? '', 10)
  }

  @Get('customer/:id/overview')
  @ApiOperation({ summary: 'One-round-trip overview: profile + wallet + recent orders/disputes/refunds' })
  @ApiOkResponse({ description: 'Customer overview payload' })
  async customerOverview(@Param('id', ParseObjectIdPipe) id: string) {
    return this.support.getCustomerOverview(id)
  }

  @Post('contact-customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a targeted 1-1 push notification to a customer' })
  @ApiOkResponse({ description: '{ delivered: boolean }' })
  async contactCustomer(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ContactCustomerDto,
    @Req() req: Request,
  ) {
    const result = await this.support.contactCustomer({
      userId:    dto.userId,
      title:     dto.title,
      body:      dto.body,
      actionUrl: dto.actionUrl,
    })
    void this.audit.log({
      ...this.auditMeta(req, user),
      action:     'support.contact_customer',
      targetType: 'user',
      targetId:   dto.userId,
      metadata:   { title: dto.title, delivered: result.delivered, hasActionUrl: !!dto.actionUrl },
    })
    return result
  }
}
