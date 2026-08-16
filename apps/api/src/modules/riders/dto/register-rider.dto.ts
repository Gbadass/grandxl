import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { VehicleType } from '@grandxl/types'

export class RegisterRiderDto {
  @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType

  @ApiPropertyOptional({ example: 'LND-123XY' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string
}
