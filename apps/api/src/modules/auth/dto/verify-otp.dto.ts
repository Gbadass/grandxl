import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator'
import { Transform } from 'class-transformer'

export class VerifyOtpDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => {
    if (value?.startsWith('+')) return value
    if (value?.startsWith('0') && value.length === 11) return `+234${value.slice(1)}`
    return value
  })
  phone!: string

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be numeric' })
  otp!: string

  @ApiPropertyOptional({ example: 'ABC12XYZ' })
  @IsOptional()
  @IsString()
  @Length(6, 12)
  @Transform(({ value }: { value: string | undefined }) => value?.toUpperCase()?.trim())
  referralCode?: string
}
