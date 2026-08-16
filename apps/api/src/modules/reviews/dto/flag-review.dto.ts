import { IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class FlagReviewDto {
  @ApiProperty({ description: 'Reason for flagging — shown to admin', maxLength: 200 })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  reason!: string
}
