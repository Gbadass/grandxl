import { IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RejectRestaurantDto {
  @ApiProperty({ example: 'Business registration documents are missing or invalid.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

export class SuspendRestaurantDto {
  @ApiProperty({ example: 'Multiple food safety complaints received from customers.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

export class RequestMoreInfoDto {
  @ApiProperty({ example: 'Please upload a valid CAC certificate showing business registration.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message!: string
}
