import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateBannerDto {
  @ApiProperty({ example: 'Free delivery weekend' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string

  @ApiPropertyOptional({ example: 'Save up to ₦500 on every order' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string

  @ApiProperty({ example: 'https://cdn.example.com/banners/free-delivery.jpg' })
  @IsUrl()
  imageUrl!: string

  @ApiPropertyOptional({ example: 'grandxl://restaurant/123' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  @IsDateString()
  startDate!: string

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  @IsDateString()
  endDate!: string

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateBannerDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  title?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  subtitle?: string

  @ApiPropertyOptional()
  @IsOptional() @IsUrl()
  imageUrl?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  linkUrl?: string

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  startDate?: string

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  endDate?: string

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number
}
