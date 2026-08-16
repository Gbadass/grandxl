import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty } from 'class-validator'
import { Transform } from 'class-transformer'

export class ForgotPasswordDto {
  @ApiProperty({ example: 'tunde@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string
}
