import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEmail,
  MinLength,
  MaxLength,
  Min,
  Max,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class CoordinatesDto {
  @ApiProperty({ example: 6.4281 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @ApiProperty({ example: 3.4219 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number
}

class AddressDto {
  @ApiProperty({ example: '15 Adeola Odeku Street' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street!: string

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string

  @ApiProperty({ example: 'Lagos State' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state!: string

  @ApiPropertyOptional({ default: 'NG' })
  @IsOptional()
  @IsString()
  country?: string

  @ApiProperty()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates!: CoordinatesDto
}

export class OpeningHoursDayDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Must be HH:MM format (e.g. 09:00)' })
  open!: string

  @ApiProperty({ example: '22:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Must be HH:MM format (e.g. 22:00)' })
  close!: string

  @ApiProperty()
  @IsBoolean()
  isOpen!: boolean
}

export class OpeningHoursDto {
  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  monday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  tuesday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  wednesday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  thursday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  friday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  saturday!: OpeningHoursDayDto

  @ApiProperty({ type: OpeningHoursDayDto })
  @ValidateNested()
  @Type(() => OpeningHoursDayDto)
  sunday!: OpeningHoursDayDto
}

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Chicken Republic Lekki' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({ example: 'Fast food restaurant serving Nigerian favourites' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  phone!: string

  @ApiPropertyOptional({ example: 'info@restaurant.com' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ example: ['Nigerian', 'Fast Food'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  cuisine!: string[]

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto

  @ApiPropertyOptional({ type: OpeningHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto

  @ApiPropertyOptional({ example: 5, description: 'Delivery radius in km' })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(50)
  deliveryRadius?: number

  @ApiPropertyOptional({ example: 0, description: 'Minimum order amount in kobo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number

  @ApiPropertyOptional({ example: 100000, description: 'Fixed delivery fee in kobo (₦1,000)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFeeFixed?: number

  @ApiPropertyOptional({ example: 30, description: 'Estimated delivery time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(180)
  estimatedDeliveryTime?: number
}
