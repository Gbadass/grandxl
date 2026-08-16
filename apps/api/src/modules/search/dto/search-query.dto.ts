import { IsString, IsOptional, IsInt, MinLength, MaxLength, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SearchQueryDto {
  @ApiProperty({ example: 'jollof rice', description: 'Search term (min 2 chars)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string

  @ApiPropertyOptional({ example: 'NG', description: 'Filter by country code' })
  @IsOptional()
  @IsString()
  country?: string

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
  @Max(50)
  limit?: number = 20
}
