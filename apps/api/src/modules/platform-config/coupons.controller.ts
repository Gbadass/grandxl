import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { IsInt, IsString, Min, MaxLength } from 'class-validator'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiProperty } from '@nestjs/swagger'
import { PlatformConfigService } from './platform-config.service'

// DTO lives next to the controller — it's small and tightly-scoped.
class ValidateCouponDto {
  @ApiProperty({ example: 'GRANDXL10' })
  @IsString()
  @MaxLength(50)
  code!: string

  @ApiProperty({ description: 'Restaurant MongoDB ObjectId' })
  @IsString()
  restaurantId!: string

  @ApiProperty({ example: 350000, description: 'Cart subtotal in kobo (before discount/fees)' })
  @IsInt()
  @Min(0)
  subtotalKobo!: number
}

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  // Customer-facing preview — does not increment usage. Usage only goes up
  // when the coupon is actually applied to a created order.
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon and preview the discount' })
  @ApiOkResponse({ description: 'Discount preview' })
  async validate(@Body() dto: ValidateCouponDto) {
    try {
      const result = await this.platformConfigService.validateCoupon(
        dto.code,
        dto.restaurantId,
        dto.subtotalKobo,
      )

      // free_delivery coupons have discountKobo=0 here but the caller waives delivery fee separately.
      // We can't know the delivery fee from a coupon validate call — surface the type so the client
      // can adjust the displayed total locally.
      const coupon = await this.platformConfigService.getCouponByCode(dto.code)

      return {
        valid:          true,
        discountAmount: result.discountKobo,
        finalTotal:     Math.max(0, dto.subtotalKobo - result.discountKobo),
        couponType:     coupon?.type,
      }
    } catch (err) {
      // Don't 4xx — turn the error message into a structured response so the
      // cart UI can show it inline next to the code input without surfacing
      // an exception toast.
      return {
        valid:          false,
        discountAmount: 0,
        finalTotal:     dto.subtotalKobo,
        errorMessage:   (err as Error).message ?? 'Invalid coupon code',
      }
    }
  }
}
