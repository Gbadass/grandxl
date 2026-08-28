import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Sprint 13 (S13-5): admin-initiated wallet credits.
//
// Force refund is tied to a specific order — the amount defaults to the full
// remaining refundable value on the order if omitted, so the common case
// ("customer got a bad delivery, refund them the full total") is one field.
export class ForceRefundDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  orderId!: string

  @ApiPropertyOptional({ example: 250000, description: 'Kobo. Omit to refund the full remaining amount.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountKobo?: number

  // Non-optional — an unaudited refund is a fraud vector, admin must justify.
  @ApiProperty({ example: 'Cold food, customer photo attached in Slack thread #12345', minLength: 3, maxLength: 300 })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string
}

// Emergency service credit is untied to any specific order — used for
// goodwill after a bad string of experiences, escalation resolutions, or
// promo-like grants that don't fit the coupon system.
export class EmergencyCreditDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  userId!: string

  @ApiProperty({ example: 100000, description: 'Kobo — minimum ₦1.00' })
  @IsInt()
  @Min(1)
  amountKobo!: number

  @ApiProperty({ example: 'Escalation ticket #789, customer support agreed to ₦1k credit', minLength: 3, maxLength: 300 })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string
}
