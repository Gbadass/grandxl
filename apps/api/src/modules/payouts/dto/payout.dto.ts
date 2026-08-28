import { IsInt, IsOptional, IsString, MaxLength, Min, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateBankAccountDto {
  @ApiProperty({ example: 'Guaranty Trust Bank' })
  @IsString()
  @MaxLength(100)
  bankName!: string

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @MaxLength(20)
  accountNumber!: string

  @ApiProperty({ example: 'ADEBAYO OYINKAN' })
  @IsString()
  @MaxLength(100)
  accountName!: string

  @ApiPropertyOptional({ example: '058', description: 'Paystack bank code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bankCode?: string
}

export class CreatePayoutRequestDto {
  @ApiProperty({ example: 250000, description: 'Amount to withdraw in kobo' })
  @IsInt()
  @Min(100_00) // ₦100 minimum
  amountKobo!: number
}

export class DecidePayoutDto {
  @ApiProperty({ enum: ['approve', 'reject', 'mark-paid'] })
  @IsString()
  decision!: 'approve' | 'reject' | 'mark-paid'

  @ApiPropertyOptional({ example: 'TRF_abc123', description: 'Required when marking as paid' })
  @IsOptional()
  @IsString()
  transferReference?: string

  @ApiPropertyOptional({ example: 'Approved — paid via GTB transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionNote?: string
}

export class VerifyAccountDto {
  @ApiProperty({ example: '0123456789' })
  @IsString()
  @MaxLength(10)
  accountNumber!: string

  @ApiProperty({ example: '058', description: 'Paystack bank code' })
  @IsString()
  @MaxLength(10)
  bankCode!: string
}

// Sprint 13 (S13-9): batch-approve N pending payouts in one call. Failures on
// individual payouts don't block the rest — the response surfaces per-id success
// so admin can retry only the ones that failed (typically Paystack balance or
// missing bank details on a specific counterparty).
export class BatchApprovePayoutsDto {
  @ApiProperty({ type: [String], description: 'Payout IDs to approve (max 50 per batch)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  payoutIds!: string[]

  @ApiPropertyOptional({ example: 'Batch approval — Friday payout run', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
