import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMethod } from '@grandxl/types'

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Order MongoDB ObjectId' })
  @IsString()
  orderId!: string

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PAYSTACK })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod

  @ApiPropertyOptional({ description: 'URL Paystack redirects to after payment' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string
}
