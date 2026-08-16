import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'

export class RefreshMobileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string
}
