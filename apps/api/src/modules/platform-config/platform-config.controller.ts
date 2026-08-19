import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger'
import { PlatformConfigService } from './platform-config.service'
import { UpdatePlatformConfigDto } from './dto/update-platform-config.dto'
import { CreateCouponDto } from './dto/create-coupon.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe'
import { UserRole } from '@grandxl/types'
import type { JwtPayload } from '@grandxl/types'

@ApiTags('Platform Config')
@ApiBearerAuth()
@Controller('platform')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  // ── Public — customers can read delivery tiers for fee display ───

  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Get platform config (delivery tiers, fees)' })
  @ApiOkResponse({ description: 'Platform config' })
  async getConfig() {
    return this.platformConfigService.getConfig()
  }

  // Lightweight public endpoint — returns only the fee rates the frontend
  // needs to render real-time cart totals. Avoids exposing commission %.
  @Get('pricing')
  @Public()
  @ApiOperation({ summary: 'Get public pricing rates (service fee %)' })
  @ApiOkResponse({ description: 'Public pricing rates' })
  async getPricing() {
    const config = await this.platformConfigService.getConfig()
    return {
      serviceFeePercent: config.serviceFeePercent,
      serviceFeeCapKobo: config.serviceFeeCapKobo,
      deliveryTiers:     config.deliveryTiers,
    }
  }

  // ── Admin — manage config ────────────────────────────────────────

  @Patch('config')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update platform config (admin)' })
  @ApiOkResponse({ description: 'Updated config' })
  async updateConfig(@Body() dto: UpdatePlatformConfigDto) {
    return this.platformConfigService.updateConfig(dto)
  }

  // ── Admin — manage coupons ───────────────────────────────────────

  @Post('coupons')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a coupon (admin)' })
  @ApiCreatedResponse({ description: 'Coupon created' })
  async createCoupon(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCouponDto,
  ) {
    return this.platformConfigService.createCoupon(user.sub, dto)
  }

  @Get('coupons')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all coupons (admin)' })
  @ApiOkResponse({ description: 'Paginated coupon list' })
  async listCoupons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platformConfigService.listCoupons(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    )
  }

  @Delete('coupons/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a coupon (admin)' })
  @ApiOkResponse({ description: 'Coupon deactivated' })
  async deactivateCoupon(@Param('id', ParseObjectIdPipe) id: string) {
    return this.platformConfigService.deactivateCoupon(id)
  }
}
