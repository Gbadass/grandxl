import { PartialType } from '@nestjs/swagger'
import { CreateRestaurantDto } from './create-restaurant.dto'
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  @ApiPropertyOptional({ description: 'Toggle the restaurant open/closed in real-time' })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean

  @ApiPropertyOptional({ description: 'Cloudinary URL for the restaurant cover/banner image' })
  @IsOptional()
  @IsString()
  coverImage?: string | null

  @ApiPropertyOptional({ description: 'Cloudinary URL for the restaurant logo' })
  @IsOptional()
  @IsString()
  logo?: string | null
}
