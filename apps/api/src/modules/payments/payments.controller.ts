import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request } from 'express'
import { PaymentsService } from './payments.service'
import { InitiatePaymentDto } from './dto/initiate-payment.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── Initiate payment ─────────────────────────────────────────────

  @Post('initiate')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate Paystack payment for an order' })
  @ApiCreatedResponse({ description: 'Returns Paystack authorization URL and reference' })
  async initiatePayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(user.sub, dto)
  }

  // ── Paystack webhook — MUST be public, raw body required ─────────

  @Post('webhook/paystack')
  @Public()
  @SkipThrottle() // Paystack is trusted upstream; HMAC verifies origin
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // not exposed in Swagger
  async paystackWebhook(
    @Req() req: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    // Raw body is available because of the rawBody: true option in main.ts bootstrap
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body))
    await this.paymentsService.handleWebhook(rawBody, signature)
    return { received: true }
  }

  // ── Verify payment reference (mobile polling fallback) ───────────

  @Get('verify/:reference')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify payment status by Paystack reference' })
  @ApiOkResponse({ description: 'Transaction record' })
  async verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Param('reference') reference: string,
  ) {
    return this.paymentsService.verifyPayment(reference, user.sub)
  }

  // ── Transaction history ──────────────────────────────────────────

  @Get('my')
  @Roles(UserRole.CUSTOMER, UserRole.RESTAURANT_OWNER, UserRole.RIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer transaction history' })
  @ApiOkResponse({ description: 'Paginated transactions' })
  async getMyTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.getMyTransactions(
      user.sub,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }
}
