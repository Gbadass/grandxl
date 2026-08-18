import { IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class TerminateRiderDto {
  @ApiProperty({ example: 'Confirmed fraud — customer order theft' })
  @IsString()
  @MinLength(5)
  reason!: string
}
