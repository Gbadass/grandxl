import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  RawBodyRequest,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { PayoutsService } from './payouts.service'
import {
  CreatePayoutRequestDto,
  DecidePayoutDto,
  UpdateBankAccountDto,
  VerifyAccountDto,
} from './dto/payout.dto'
import { PayoutStatus, type PayoutEntityType } from './schemas/payout-request.schema'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Idempotent } from '../../common/decorators/idempotent.decorator'
import { AuditService } from '../audit/audit.service'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

// ── Rider-facing ────────────────────────────────────────────────────

@ApiTags('Rider — Payouts')
@ApiBearerAuth()
@Roles(UserRole.RIDER)
@Controller('rider/payouts')
export class RiderPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('bank-account')
  @ApiOperation({ summary: 'Get my bank account' })
  getBankAccount(@CurrentUser() user: JwtPayload) {
    return this.payouts.getBankAccount(user.sub)
  }

  @Put('bank-account')
  @ApiOperation({ summary: 'Update my bank account' })
  updateBankAccount(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBankAccountDto) {
    return this.payouts.updateBankAccount(user.sub, dto)
  }

  @Get('banks')
  @ApiOperation({ summary: 'List Nigerian banks (from Paystack)' })
  getBanks() {
    return this.payouts.getBanksList()
  }

  @Post('verify-account')
  @ApiOperation({ summary: 'Verify bank account number via Paystack' })
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.payouts.resolveAccount(dto.accountNumber, dto.bankCode)
  }

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Request a payout from my earnings (send Idempotency-Key header)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePayoutRequestDto) {
    return this.payouts.createRequest(user.sub, dto.amountKobo)
  }

  @Get()
  @ApiOperation({ summary: 'List my payout requests' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.payouts.listForRider(
      user.sub,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }
}

// ── Restaurant-facing (S12-6) ───────────────────────────────────────

@ApiTags('Restaurant — Payouts')
@ApiBearerAuth()
@Roles(UserRole.RESTAURANT_OWNER)
@Controller('restaurant/payouts')
export class RestaurantPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('bank-account')
  @ApiOperation({ summary: 'Get my restaurant bank account' })
  getBankAccount(@CurrentUser() user: JwtPayload) {
    return this.payouts.getRestaurantBankAccount(user.sub)
  }

  @Put('bank-account')
  @ApiOperation({ summary: 'Update my restaurant bank account' })
  updateBankAccount(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBankAccountDto) {
    return this.payouts.updateRestaurantBankAccount(user.sub, dto)
  }

  @Get('banks')
  @ApiOperation({ summary: 'List Nigerian banks (proxy of Paystack)' })
  getBanks() {
    return this.payouts.getBanksList()
  }

  @Post('verify-account')
  @ApiOperation({ summary: 'Verify bank account number via Paystack' })
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.payouts.resolveAccount(dto.accountNumber, dto.bankCode)
  }

  @Get('summary')
  @ApiOperation({ summary: 'Available balance + pending hold + in-flight request status' })
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.payouts.getRestaurantEarningsSummary(user.sub)
  }

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Request a payout from my restaurant earnings (send Idempotency-Key header)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePayoutRequestDto) {
    return this.payouts.createRestaurantRequest(user.sub, dto.amountKobo)
  }

  @Get()
  @ApiOperation({ summary: 'List my restaurant payout requests' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    return this.payouts.listForRestaurant(
      user.sub,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }
}

// ── Admin-facing ────────────────────────────────────────────────────

@ApiTags('Admin — Payouts')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/payouts')
export class AdminPayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly audit:   AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List payout requests (filterable by status + entity type)' })
  list(
    @Query('status')     status?:     PayoutStatus,
    @Query('entityType') entityType?: PayoutEntityType,
    @Query('page')       page?:       string,
    @Query('limit')      limit?:      string,
  ) {
    return this.payouts.listForAdmin(
      status,
      entityType,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Patch(':id/decide')
  @ApiOperation({ summary: 'Approve, reject, or mark a payout as paid' })
  async decide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DecidePayoutDto,
    @Req() req: Request,
  ) {
    const meta = {
      actorId:   user.sub,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip,
      userAgent: req.headers['user-agent'],
    }

    if (dto.decision === 'approve') {
      const result = await this.payouts.approve(user.sub, id, dto.decisionNote)
      void this.audit.log({ ...meta, action: 'payout.approve', targetType: 'payout', targetId: id })
      return result
    }
    if (dto.decision === 'reject') {
      const result = await this.payouts.reject(user.sub, id, dto.decisionNote)
      void this.audit.log({ ...meta, action: 'payout.reject', targetType: 'payout', targetId: id, metadata: { note: dto.decisionNote } })
      return result
    }
    if (dto.decision === 'mark-paid') {
      if (!dto.transferReference) {
        throw new BadRequestException('transferReference is required to mark paid')
      }
      const result = await this.payouts.markPaid(user.sub, id, dto.transferReference, dto.decisionNote)
      void this.audit.log({
        ...meta,
        action:     'payout.mark_paid',
        targetType: 'payout',
        targetId:   id,
        metadata:   { transferReference: dto.transferReference, amountKobo: result.amountKobo },
      })
      return result
    }
    throw new BadRequestException('Unknown decision')
  }
}

// ── Paystack Webhook ────────────────────────────────────────────────

@ApiTags('Webhooks')
@Public()
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  constructor(private readonly payouts: PayoutsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook receiver' })
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() body: Record<string, unknown>,
  ) {
    const rawBody = req.rawBody
    if (!rawBody || !signature) {
      throw new BadRequestException('Missing signature or body')
    }

    if (!this.payouts.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid signature')
    }

    await this.payouts.handleWebhookEvent(body as never)
    return { received: true }
  }
}
