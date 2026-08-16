import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateSurgeRuleDto {
  @ApiProperty({ example: 'Friday dinner rush' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 1.5, description: 'Multiplier on the base delivery fee. Capped at 5x.' })
  @IsNumber()
  @Min(1)
  @Max(5)
  multiplier!: number

  @ApiProperty({ example: [5, 6], description: '0=Sun..6=Sat' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[]

  @ApiProperty({ example: 1080, description: 'Minutes since midnight (18:00 = 1080)' })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinutes!: number

  @ApiProperty({ example: 1320, description: 'Minutes since midnight (22:00 = 1320)' })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinutes!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class UpdateSurgeRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(5) multiplier?: number
  @ApiPropertyOptional() @IsOptional() @IsArray() @ArrayMinSize(1) daysOfWeek?: number[]
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1440) startMinutes?: number
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1440) endMinutes?: number
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean
}
