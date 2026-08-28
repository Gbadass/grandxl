import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMinSize, ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator'
import { UserRole } from '@grandxl/types'

// Sprint 13 (S13-8): admin-initiated broadcast payload. Audience is by role;
// per-user targeting is not in scope. Body is stored + shown in a push
// notification, so we cap it aggressively — long announcements should link
// out via `actionUrl` to a full page.
export class CreateBroadcastDto {
  @ApiProperty({
    enum: UserRole,
    isArray: true,
    example: [UserRole.CUSTOMER, UserRole.RIDER],
    description: 'One or more audience roles. SUPER_ADMIN is refused server-side — use in-app admin comms.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(UserRole, { each: true })
  audiences!: UserRole[]

  @ApiProperty({ example: 'Maintenance window Saturday 2-4am', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string

  @ApiProperty({ example: 'Ordering will pause briefly during a database upgrade. Existing orders continue.', minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  body!: string

  @ApiPropertyOptional({ example: 'https://grandxl.com/status', description: 'Optional deep-link — customer taps push to open' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  actionUrl?: string
}
