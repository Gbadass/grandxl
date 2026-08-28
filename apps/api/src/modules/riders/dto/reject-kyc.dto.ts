import { IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

// Sprint 13 (S13-7): admin rejects a rider's uploaded KYC docs with a reason
// so the rider knows what to fix. Reason is required and surfaced to the
// rider verbatim in the push notification, so it needs to be specific.
export class RejectKycDto {
  @ApiProperty({
    example: 'Driver\'s license photo is blurry — please re-upload a sharper image showing all corners.',
    minLength: 5,
    maxLength: 300,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  reason!: string
}
