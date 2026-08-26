import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { RefundsService } from './refunds.service'
import { CreateRefundRequestDto, DecideRefundDto } from './dto/create-refund-request.dto'
import { RefundMethod, RefundStatus } from './schemas/refund-request.schema'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { AuditService } from '../audit/audit.service'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundsController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly audit:   AuditService,
  ) {}

  // ── Customer ─────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Open a refund request for an order' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRefundRequestDto) {
    return this.refunds.createRequest(user.sub, dto)
  }

  @Get('my')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'List my refund requests' })
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.refunds.listForCustomer(
      user.sub,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }
}

@ApiTags('Admin — Refunds')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/refunds')
export class AdminRefundsController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly audit:   AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List refund requests (filterable by status)' })
  list(
    @Query('status') status?: RefundStatus,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.refunds.listForAdmin(
      status,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Patch(':id/decide')
  @ApiOperation({ summary: 'Approve or reject a refund request' })
  async decide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DecideRefundDto,
    @Req() req: Request,
  ) {
    const meta = {
      actorId:   user.sub,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
    }

    if (dto.decision === 'approve') {
      if (!dto.method) throw new BadRequestException('method is required when approving')
      const method = dto.method === 'wallet' ? RefundMethod.WALLET : RefundMethod.ORIGINAL
      const result = await this.refunds.approve(user, id, method, dto.decisionNote)
      void this.audit.log({
        ...meta,
        action:     'refund.approve',
        targetType: 'refund_request',
        targetId:   id,
        metadata:   { method, amountKobo: result.amountKobo, note: dto.decisionNote },
      })
      return result
    }

    const result = await this.refunds.reject(user, id, dto.decisionNote)
    void this.audit.log({
      ...meta,
      action:     'refund.reject',
      targetType: 'refund_request',
      targetId:   id,
      metadata:   { note: dto.decisionNote },
    })
    return result
  }
}
