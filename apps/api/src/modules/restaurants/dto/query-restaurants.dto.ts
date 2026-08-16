import { IsOptional, IsNumber, IsString, Min, Max, IsInt } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class QueryRestaurantsDto {
  @ApiPropertyOptional({ description: 'Latitude of delivery location', example: 6.4281 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number

  @ApiPropertyOptional({ description: 'Longitude of delivery location', example: 3.4219 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number

  @ApiPropertyOptional({ description: 'Search radius in km', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radius?: number = 10

  @ApiPropertyOptional({ description: 'Filter by cuisine type', example: 'Nigerian' })
  @IsOptional()
  @IsString()
  cuisine?: string

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
