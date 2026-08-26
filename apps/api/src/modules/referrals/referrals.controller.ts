import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Body,
  Query,
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
import { ReferralsService } from './referrals.service'
import { ApplyReferralDto } from './dto/apply-referral.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // ── GET /referrals/me ────────────────────────────────────────────────────

  @Get('me')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Get my referral code and earnings stats' })
  @ApiOkResponse({ description: 'Referral info' })
  async getMyInfo(@CurrentUser() user: JwtPayload) {
    return this.referralsService.getMyReferralInfo(user.sub)
  }

  // ── POST /referrals/apply ─────────────────────────────────────────────────

  @Post('apply')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a referral code to the current (new) account' })
  @ApiCreatedResponse({ description: 'Referral code applied' })
  async applyCode(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApplyReferralDto,
  ) {
    await this.referralsService.applyReferralCode(user.sub, dto.code)
    return { applied: true }
  }
}

@ApiTags('Admin — Referrals')
@ApiBearerAuth()
@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('overview')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform-wide referral analytics + top referrers' })
  @ApiOkResponse({ description: 'Overview stats' })
  @ApiQuery({ name: 'days', required: false, description: 'Lookback window (default 30)' })
  getOverview(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.referralsService.getAdminOverview(days)
  }
}
