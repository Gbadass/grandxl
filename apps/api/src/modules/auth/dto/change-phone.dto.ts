import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches } from 'class-validator'

const E164 = /^\+[1-9]\d{6,14}$/

export class RequestPhoneChangeDto {
  @ApiProperty({ example: '+2348012345678', description: 'New phone number in E.164 format' })
  @IsString()
  @Matches(E164, { message: 'Phone must be in E.164 format (e.g. +2348012345678)' })
  newPhone!: string

  @ApiProperty({ description: 'Current password — re-verified before sending the OTP' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string
}

export class VerifyPhoneChangeDto {
  @ApiProperty({ example: '123456', description: 'OTP sent to the new phone' })
  @IsString()
  @Matches(/^\d{4,8}$/, { message: 'OTP must be 4-8 digits' })
  otp!: string
}
