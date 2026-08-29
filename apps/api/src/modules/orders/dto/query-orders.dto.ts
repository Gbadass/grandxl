import { IsOptional, IsEnum, IsInt, IsString, MaxLength, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus, PaymentStatus } from '@grandxl/types'

export class QueryOrdersDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus

  // MVP ops search: matches order number, customer phone / first / last name,
  // and restaurant name — case-insensitive substring. Resolved server-side via
  // aggregation $lookup so all four searchable columns hit one query.
  @ApiPropertyOptional({ description: 'Free-text search across order#, customer name/phone, restaurant name' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
