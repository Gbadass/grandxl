import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@grandxl.com' })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string
}
