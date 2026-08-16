import { IsString, IsOptional, IsUrl, IsInt, Min, IsBoolean } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateFoodCategoryDto {
  @ApiProperty({ example: 'Burgers' })
  @IsString()
  name!: string

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsUrl()
  image?: string

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateFoodCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  image?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
