import {
  IsString,
  MinLength,
  MaxLength,
  IsArray,
  IsOptional,
  IsNumber,
  IsEmail,
  Min,
  Max,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RejectRestaurantDto {
  @ApiProperty({ example: 'Business registration documents are missing or invalid.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

export class SuspendRestaurantDto {
  @ApiProperty({ example: 'Multiple food safety complaints received from customers.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

export class RequestMoreInfoDto {
  @ApiProperty({ example: 'Please upload a valid CAC certificate showing business registration.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message!: string
}

export class TerminateRestaurantDto {
  @ApiProperty({ example: 'Repeated food safety violations despite two prior suspensions.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

class OnboardAddressDto {
  @ApiProperty({ example: '15 Adeola Odeku Street' })
  @IsString() @MinLength(1) @MaxLength(200)
  street!: string

  @ApiProperty({ example: 'Lagos' })
  @IsString() @MinLength(1) @MaxLength(100)
  city!: string

  @ApiProperty({ example: 'Lagos' })
  @IsString() @MinLength(1) @MaxLength(100)
  state!: string

  @ApiPropertyOptional({ example: 'NG' })
  @IsOptional() @IsString()
  country?: string

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  lat?: number

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  lng?: number
}

export class AdminOnboardRestaurantDto {
  @ApiProperty({ example: '+2348012345678', description: 'Owner phone — existing GrandXL account or new account if ownerFirstName/ownerLastName are provided' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must be E.164 format (+2348012345678)' })
  ownerPhone!: string

  @ApiPropertyOptional({ example: 'Amaka', description: 'Required only when creating a new owner account (phone not yet registered)' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  ownerFirstName?: string

  @ApiPropertyOptional({ example: 'Okonkwo', description: 'Required only when creating a new owner account' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  ownerLastName?: string

  @ApiPropertyOptional({ example: 'amaka@restaurant.com', description: 'Owner email — used to send welcome credentials when creating a new account' })
  @IsOptional() @IsEmail()
  ownerEmail?: string

  @ApiPropertyOptional({ description: 'Password for the new owner account — required when ownerPhone is not yet registered' })
  @IsOptional() @IsString() @MinLength(8)
  ownerPassword?: string

  @ApiProperty({ example: 'Amaka\'s Kitchen' })
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must be E.164 format' })
  phone!: string

  @ApiPropertyOptional({ example: 'restaurant@example.com' })
  @IsOptional() @IsEmail()
  email?: string

  @ApiPropertyOptional({ example: 'Authentic Nigerian home cooking' })
  @IsOptional() @IsString() @MaxLength(500)
  description?: string

  @ApiProperty({ example: ['Nigerian', 'African'] })
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  cuisine!: string[]

  @ApiProperty()
  @ValidateNested() @Type(() => OnboardAddressDto)
  address!: OnboardAddressDto

  @ApiPropertyOptional({ example: 100000, description: 'Min order in kobo' })
  @IsOptional() @IsNumber() @Min(0)
  minOrderAmount?: number

  @ApiPropertyOptional({ example: 30, description: 'Estimated delivery time in minutes' })
  @IsOptional() @IsNumber() @Min(1) @Max(180)
  estimatedDeliveryTime?: number

  @ApiPropertyOptional({ example: 150000, description: 'Delivery fee in kobo' })
  @IsOptional() @IsNumber() @Min(0)
  deliveryFeeFixed?: number

  @ApiPropertyOptional({ example: 5, description: 'Delivery radius in km' })
  @IsOptional() @IsNumber() @Min(0.5) @Max(50)
  deliveryRadius?: number
}
