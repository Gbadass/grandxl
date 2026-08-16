import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

type CouponType = 'percentage' | 'fixed_amount' | 'free_delivery'

export class CreateCouponDto {
  @ApiProperty({ example: 'GRANDXL10' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code!: string

  @ApiProperty({ enum: ['percentage', 'fixed_amount', 'free_delivery'] })
  @IsEnum(['percentage', 'fixed_amount', 'free_delivery'])
  type!: CouponType

  @ApiProperty({ example: 10, description: '10 for 10%, or kobo amount for fixed_amount' })
  @IsNumber()
  @Min(0)
  value!: number

  @ApiPropertyOptional({ example: 500000, description: 'Min order subtotal in kobo' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number

  @ApiPropertyOptional({ example: 200000, description: 'Max discount in kobo (0 = no cap)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscount?: number

  @ApiPropertyOptional({ example: 100, description: '0 = unlimited uses' })
  @IsOptional()
  @IsInt()
  @Min(0)
  usageLimit?: number

  @ApiPropertyOptional({ example: 1, description: 'Max uses per customer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number

  @ApiPropertyOptional({ type: [String], description: 'Restaurant IDs (empty = all)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableRestaurants?: string[]

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate!: string

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  endDate!: string
}
