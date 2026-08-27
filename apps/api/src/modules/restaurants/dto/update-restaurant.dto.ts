import { PartialType } from '@nestjs/swagger'
import { CreateRestaurantDto } from './create-restaurant.dto'
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'
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

  // Sprint 12 (S12-9): photo gallery URLs. Max 12 keeps the customer strip fast
  // and prevents any single restaurant from blowing up the payload size.
  @ApiPropertyOptional({ description: 'Cloudinary URLs for the restaurant photo gallery (max 12)', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  gallery?: string[]
}
