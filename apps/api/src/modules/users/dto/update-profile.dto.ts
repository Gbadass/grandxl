import { IsString, IsUrl, IsOptional, MaxLength, MinLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

// Email and phone are DELIBERATELY not in this DTO — those fields are identity
// anchors. Changing them without re-verification is an account-hijack vector
// (attacker with a session can change email → forgot-password → takeover).
// Use POST /auth/change-email and POST /auth/change-phone which run through an
// OTP/verification-link flow.
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string

  @ApiPropertyOptional({ example: 'Okafor' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/grandxl/...' })
  @IsOptional()
  @IsUrl()
  avatar?: string
}
