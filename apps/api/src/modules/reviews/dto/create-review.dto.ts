import { IsString, IsInt, IsOptional, Min, Max, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateReviewDto {
  @ApiProperty({ description: 'Order MongoDB ObjectId' })
  @IsString()
  orderId!: string

  @ApiProperty({ example: 4, description: 'Restaurant rating 1–5' })
  @IsInt()
  @Min(1)
  @Max(5)
  restaurantRating!: number

  @ApiPropertyOptional({ example: 5, description: 'Rider rating 1–5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  riderRating?: number

  @ApiPropertyOptional({ example: 4, description: 'Food quality rating 1–5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  foodRating?: number

  @ApiPropertyOptional({ example: 'Great jollof rice, fast delivery!', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}
