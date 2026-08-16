import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { IsString, IsOptional, IsEmail, MinLength, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'

export class LoginDto {
  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string }) => {
    if (value?.startsWith('+')) return value
    if (value?.startsWith('0') && value.length === 11) return `+234${value.slice(1)}`
    return value
  })
  phone?: string

  @ApiPropertyOptional({ example: 'tunde@example.com' })
  @IsEmail()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email?: string

  @ApiProperty({ example: 'SecurePass1' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string
}
