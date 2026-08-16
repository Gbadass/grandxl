import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common'
import { IsInt, Min } from 'class-validator'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger'
import { WalletService } from './wallet.service'
import { PaymentsService } from '../payments/payments.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Idempotent } from '../../common/decorators/idempotent.decorator'
import type { JwtPayload } from '@grandxl/types'

class TopUpDto {
  @ApiProperty({ example: 500_000, description: 'Top-up amount in kobo (min ₦100, max ₦500,000)' })
  @IsInt()
  @Min(100_00)
  amountKobo!: number
}

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet:   WalletService,
    private readonly payments: PaymentsService,
  ) {}

  @Post('topup')
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate a wallet top-up via Paystack' })
  topup(@CurrentUser() user: JwtPayload, @Body() dto: TopUpDto) {
    return this.payments.initiateWalletTopUp(user.sub, dto.amountKobo)
  }

  @Get()
  @ApiOperation({ summary: "Current user's wallet" })
  async balance(@CurrentUser() user: JwtPayload) {
    const wallet = await this.wallet.ensureWallet(user.sub) as unknown as {
      _id:      { toString(): string }
      userId:   { toString(): string }
      balance:  number
      currency: string
      createdAt: Date
      updatedAt: Date
    }
    return {
      _id:       wallet._id.toString(),
      userId:    wallet.userId.toString(),
      balance:   wallet.balance,
      currency:  wallet.currency,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    }
  }

  @Get('transactions')
  @ApiOperation({ summary: "List current user's wallet transactions (paginated)" })
  async transactions(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
  ) {
    const p = page  ? parseInt(page,  10) : 1
    const l = limit ? parseInt(limit, 10) : 20
    const result = await this.wallet.listTransactions(user.sub, p, l)
    return {
      data: result.items,
      meta: { page: result.page, limit: result.limit, total: result.total, pages: result.pages },
    }
  }
}
