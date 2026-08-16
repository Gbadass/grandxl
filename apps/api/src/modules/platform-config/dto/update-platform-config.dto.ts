import { IsOptional, IsInt, IsNumber, IsArray, IsBoolean, Min, Max, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

class EnabledServicesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() instamart?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dineout?: boolean
  @ApiPropertyOptional() @IsOptional() @IsBoolean() drinks?: boolean
}

class DeliveryTierDto {
  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(0)
  maxKm!: number

  @ApiPropertyOptional({ example: 100000 })
  @IsInt()
  @Min(0)
  feeKobo!: number
}

export class UpdatePlatformConfigDto {
  @ApiPropertyOptional({ type: [DeliveryTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryTierDto)
  deliveryTiers?: DeliveryTierDto[]

  @ApiPropertyOptional({ example: 15, description: 'Platform commission %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformCommissionPercent?: number

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  serviceFeeCapKobo?: number

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minRiderEarningKobo?: number

  @ApiPropertyOptional({ type: EnabledServicesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnabledServicesDto)
  enabledServices?: EnabledServicesDto
}
