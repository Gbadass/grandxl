import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty, MinLength } from 'class-validator'
import { Transform } from 'class-transformer'

export class PortalLoginDto {
  @ApiProperty({ example: 'user@example.com or +2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  emailOrPhone!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string
}
