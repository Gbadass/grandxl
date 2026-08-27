import { IsString, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// Sprint 13 (S13-4): admin manual rider reassignment. The `reason` is optional
// on the wire but the admin controller writes it into the audit log — a
// missing reason still audits but the metadata just lacks a "why".
export class ReassignRiderDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'MongoDB ObjectId of the new rider' })
  @IsString()
  riderId!: string

  @ApiPropertyOptional({ example: 'Original rider unreachable for 15 minutes', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}
