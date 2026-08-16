import { IsString, IsOptional, IsInt, Min, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateMenuCategoryDto {
  @ApiProperty({ example: 'Burgers' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string

  @ApiPropertyOptional({ example: 'Our signature hand-crafted burgers' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiPropertyOptional({ default: 0, description: 'Display order — lower numbers appear first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateMenuCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
