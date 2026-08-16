import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator'

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string

  @ApiProperty({ example: 'NewSecurePass1' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword!: string
}
