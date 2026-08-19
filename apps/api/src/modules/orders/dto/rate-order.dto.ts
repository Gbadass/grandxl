import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RateOrderDto {
  @ApiProperty({ example: 5, description: '1–5 star rating' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number

  @ApiPropertyOptional({ example: 'Food was hot and delivered on time!', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewText?: string
}
