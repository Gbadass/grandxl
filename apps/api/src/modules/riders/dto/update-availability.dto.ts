import { IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateAvailabilityDto {
  @ApiProperty({ example: true, description: 'true = online and accepting jobs' })
  @IsBoolean()
  isOnline!: boolean
}
