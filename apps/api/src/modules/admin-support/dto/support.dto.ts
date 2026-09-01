import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator'
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

// S13-14: targeted 1-1 push from a support agent to a customer. Distinct from
// broadcast (which fans out by role) — this is for "we're calling you about
// order X" or "your refund is on the way, we'll follow up".
export class ContactCustomerDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  userId!: string

  @ApiProperty({ example: 'About your recent order', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string

  @ApiProperty({ example: 'Hi Gerald, we noticed your last order was delivered late. Please reply here and we\'ll credit you.', minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  body!: string

  @ApiPropertyOptional({ example: 'https://grandxl.com/support/ticket/123', description: 'Optional deep link the notification tap opens' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  actionUrl?: string
}
