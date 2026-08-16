import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

class CoordinatesDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @ApiPropertyOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number
}

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'Work' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  instructions?: string
}
