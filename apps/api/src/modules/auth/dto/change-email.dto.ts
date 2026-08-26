import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

export class RequestEmailChangeDto {
  @ApiProperty({ description: 'New email address — verification link is sent here' })
  @IsEmail()
  newEmail!: string

  @ApiProperty({ description: 'Current password — re-verified before sending the link' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string
}

export class VerifyEmailChangeDto {
  @ApiProperty({ description: 'Token from the verification email link' })
  @IsString()
  @IsNotEmpty()
  token!: string
}
