import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, MinLength, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateDeliveryZoneDto {
  @ApiProperty({ example: 'Lagos Island' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  // Array of [lng, lat] pairs. Must be at least 4 points (3 corners + closing).
  @ApiProperty({
    description: 'Ordered list of [lng, lat] pairs forming a closed polygon. First point must equal last.',
    example: [[3.38, 6.45], [3.42, 6.45], [3.42, 6.48], [3.38, 6.48], [3.38, 6.45]],
  })
  @IsArray()
  @ArrayMinSize(4)
  coordinates!: [number, number][]

  @ApiPropertyOptional({ example: 1.0, description: 'Multiplier on the restaurant delivery fee' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFeeMultiplier?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateDeliveryZoneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMinSize(4) coordinates?: [number, number][]
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) deliveryFeeMultiplier?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean
}
