import { PartialType } from '@nestjs/swagger'
import { CreateRestaurantDto } from './create-restaurant.dto'
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, ValidateNested, MaxLength, Matches } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Sprint 12 (S12-10): per-date override
export class SpecialHoursEntryDto {
  // Local calendar day in the restaurant's timezone — YYYY-MM-DD.
  @ApiProperty({ example: '2026-12-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string

  @ApiProperty({ example: false })
  @IsBoolean()
  isClosed!: boolean

  @ApiPropertyOptional({ example: '12:00', description: 'HH:mm — required when !isClosed' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open must be HH:mm' })
  open?: string

  @ApiPropertyOptional({ example: '18:00', description: 'HH:mm — required when !isClosed' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close must be HH:mm' })
  close?: string

  @ApiPropertyOptional({ example: 'Christmas Day', description: 'Free-text shown to customer' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string
}

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

  // Sprint 12 (S12-10): date-specific overrides. Cap at 90 (roughly 3 months
  // of daily overrides — well beyond any real use case).
  @ApiPropertyOptional({ description: 'Date-specific override list (max 90)', type: [SpecialHoursEntryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(90)
  @ValidateNested({ each: true })
  @Type(() => SpecialHoursEntryDto)
  specialHours?: SpecialHoursEntryDto[]
}
