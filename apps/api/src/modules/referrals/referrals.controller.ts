import {
  Controller,
  Get,
  Post,
  Body,
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
