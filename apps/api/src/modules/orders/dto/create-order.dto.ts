import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMethod } from '@grandxl/types'

class SelectedVariantDto {
  @ApiProperty({ example: 'Size' })
  @IsString()
  variantName!: string

  @ApiProperty({ example: 'Large' })
  @IsString()
  optionName!: string

  @ApiProperty({ example: 10000 })
  @IsInt()
  @Min(0)
  priceAdjustment!: number
}

class SelectedAddOnDto {
  @ApiProperty({ example: 'Extra Cheese' })
  @IsString()
  name!: string

  @ApiProperty({ example: 3000 })
  @IsInt()
  @Min(0)
  price!: number
}

export class OrderItemInputDto {
  @ApiProperty({ description: 'Menu item MongoDB ObjectId' })
  @IsString()
  menuItemId!: string

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number

  @ApiPropertyOptional({ type: [SelectedVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedVariantDto)
  selectedVariants?: SelectedVariantDto[]

  @ApiPropertyOptional({ type: [SelectedAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedAddOnDto)
  selectedAddOns?: SelectedAddOnDto[]

  @ApiPropertyOptional({ example: 'No onions please', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string
}

class DeliveryCoordinatesDto {
  @ApiProperty({ example: 6.5244, description: 'Latitude (WGS-84)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @ApiProperty({ example: 3.3792, description: 'Longitude (WGS-84)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number
}

class DeliveryAddressInputDto {
  @ApiProperty({ example: '14 Bourdillon Road' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street!: string

  @ApiProperty({ example: 'Ikoyi' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  city!: string

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  state!: string

  @ApiProperty({ type: DeliveryCoordinatesDto })
  @ValidateNested()
  @Type(() => DeliveryCoordinatesDto)
  coordinates!: DeliveryCoordinatesDto
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Restaurant MongoDB ObjectId' })
  @IsString()
  restaurantId!: string

  @ApiProperty({ type: [OrderItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @ArrayMinSize(1)
  items!: OrderItemInputDto[]

  @ApiProperty({ type: DeliveryAddressInputDto })
  @ValidateNested()
  @Type(() => DeliveryAddressInputDto)
  deliveryAddress!: DeliveryAddressInputDto

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PAYSTACK })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod

  @ApiPropertyOptional({ example: 'GRANDXL10', description: 'Coupon code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string

  @ApiPropertyOptional({ example: 50000, description: 'Rider tip in kobo. 100% goes to the rider on top of delivery fee.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50_000_00) // ₦50,000 sanity cap
  tip?: number

  @ApiPropertyOptional({ description: 'If true, apply wallet balance against the total before charging the card.' })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean

  @ApiPropertyOptional({
    description: 'ISO datetime to schedule the order for. Must be at least 60 minutes in the future, at most 7 days out. Omit for "order now".',
    example: '2026-06-30T19:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string

  @ApiPropertyOptional({ example: 'Leave at gate', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customerNote?: string

  @ApiPropertyOptional({ example: 'Flat 3B, ring bell twice', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryInstructions?: string

  // Sprint 12 (S12-11): the customer explicitly opted-in to a delivery whose
  // address is beyond the restaurant's normal `deliveryRadius`. Server double-
  // checks the geometry — a truthy flag alone won't bypass a hard-limit check.
  @ApiPropertyOptional({ example: true, description: 'Customer opted in to a far-delivery beyond the restaurant\'s normal radius' })
  @IsOptional()
  @IsBoolean()
  farDeliveryAcknowledged?: boolean
}
