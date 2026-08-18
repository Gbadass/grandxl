import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SuspendRiderDto {
  @ApiProperty({ example: 'Multiple customer complaints about reckless riding' })
  @IsString()
  @MinLength(5)
  reason!: string
}
