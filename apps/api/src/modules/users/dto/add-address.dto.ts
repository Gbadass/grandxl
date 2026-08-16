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

export class AddAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  label!: string

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

  @ApiProperty({ type: CoordinatesDto })
  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates!: CoordinatesDto

  @ApiPropertyOptional({ example: 'Blue gate, call on arrival' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  instructions?: string
}
