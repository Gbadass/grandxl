import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  IsArray,
  IsUrl,
  IsIn,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class VariantOptionDto {
  @ApiProperty({ example: 'Large' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string

  @ApiPropertyOptional({ example: 10000, description: 'Price added to basePrice in kobo (0 = no extra charge)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceAdjustment?: number
}

class VariantDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string

  @ApiPropertyOptional({ default: false, description: 'Customer must choose one option' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @ApiProperty({ type: [VariantOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionDto)
  @ArrayMinSize(1)
  options!: VariantOptionDto[]
}

class AddOnDto {
  @ApiProperty({ example: 'Extra Cheese' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string

  @ApiProperty({ example: 3000, description: 'Price in kobo' })
  @IsInt()
  @Min(0)
  price!: number

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Jollof Rice' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({ example: 'Party-style smoky jollof rice with your choice of protein' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/grandxl/...' })
  @IsOptional()
  @IsUrl()
  image?: string

  @ApiProperty({ example: 250000, description: 'Base price in kobo (₦2,500 = 250000)' })
  @IsInt()
  @Min(0)
  basePrice!: number

  @ApiProperty({ description: 'Category this item belongs to (MongoDB ObjectId)' })
  @IsString()
  categoryId!: string

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean

  @ApiPropertyOptional({ default: false, description: 'Show in the Popular section' })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean

  @ApiPropertyOptional({ default: 0, description: 'Display order within the category' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @ApiPropertyOptional({ type: [VariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[]

  @ApiPropertyOptional({ type: [AddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnDto)
  addOns?: AddOnDto[]

  @ApiPropertyOptional({ example: ['nuts', 'dairy'], description: 'List of allergens' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[]

  @ApiPropertyOptional({ example: 450, description: 'Calories per serving' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  calories?: number

  @ApiPropertyOptional({ example: 15, description: 'Per-item prep time in minutes (kitchen estimate)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  prepTimeMinutes?: number

  @ApiPropertyOptional({ example: 25, description: 'Available stock count. Omit or null for unlimited.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockCount?: number

  @ApiPropertyOptional({ example: 5, description: 'Alert when stockCount falls below this' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number
}

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  image?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @ApiPropertyOptional({ type: [VariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[]

  @ApiPropertyOptional({ type: [AddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnDto)
  addOns?: AddOnDto[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  calories?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  prepTimeMinutes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  stockCount?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number
}

// ── Sprint 12 (S12-7): bulk edit DTOs ────────────────────────────────────────
// Cap at 200 items per call — well above the largest single-restaurant menu
// we've seen in production, keeps the write batch small enough that a single
// Mongo op stays fast.

const BULK_MAX = 200

export class BulkItemIdsDto {
  @ApiProperty({ type: [String], description: 'Item IDs to operate on (max 200)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX)
  @IsString({ each: true })
  itemIds!: string[]
}

export class BulkAvailabilityDto extends BulkItemIdsDto {
  @ApiProperty({ example: true, description: 'Set all selected items to this availability' })
  @IsBoolean()
  isAvailable!: boolean
}

export class BulkCategoryDto extends BulkItemIdsDto {
  @ApiProperty({ description: 'Target category ID (must belong to the same restaurant)' })
  @IsString()
  categoryId!: string
}

// Price adjustment mode:
//  - 'percent' → newPrice = round(oldPrice * (1 + value/100))  (+10 = +10%, -10 = -10%)
//  - 'fixed'   → newPrice = max(0, oldPrice + valueKobo)       (add or subtract kobo)
//  - 'set'     → newPrice = valueKobo                          (absolute price)
export class BulkPriceDto extends BulkItemIdsDto {
  @ApiProperty({ enum: ['percent', 'fixed', 'set'] })
  @IsIn(['percent', 'fixed', 'set'])
  mode!: 'percent' | 'fixed' | 'set'

  // Percent for 'percent' mode; kobo for 'fixed'/'set'.
  @ApiProperty({ example: 10, description: 'Percent (percent mode) or kobo (fixed/set)' })
  @IsNumber()
  value!: number
}
