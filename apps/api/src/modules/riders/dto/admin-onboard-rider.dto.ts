import { IsEnum, IsOptional, IsString, MinLength, MaxLength, IsEmail, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { VehicleType } from '@grandxl/types'

export class AdminOnboardRiderDto {
  @ApiProperty({ example: '+2348012345678', description: 'Rider phone — existing GrandXL account or new account if firstName/lastName/password provided' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must be E.164 format (+2348012345678)' })
  riderPhone!: string

  @ApiPropertyOptional({ example: 'Chukwuemeka', description: 'Required when creating a new account (phone not yet registered)' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  riderFirstName?: string

  @ApiPropertyOptional({ example: 'Okafor', description: 'Required when creating a new account' })
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  riderLastName?: string

  @ApiPropertyOptional({ example: 'emeka@email.com', description: 'Rider email — used to send welcome credentials' })
  @IsOptional() @IsEmail()
  riderEmail?: string

  @ApiPropertyOptional({ description: 'Password for the new rider account — required when phone is not yet registered' })
  @IsOptional() @IsString() @MinLength(8)
  riderPassword?: string

  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType

  @ApiPropertyOptional({ example: 'LND-123XY' })
  @IsOptional() @IsString() @MaxLength(20)
  vehiclePlate?: string
}
