import { IsString, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdatePushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, { message: 'Must be a valid Expo push token' })
  expoPushToken!: string
}
