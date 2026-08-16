import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateRefundRequestDto {
  @ApiProperty({ description: 'Order MongoDB ObjectId' })
  @IsString()
  orderId!: string

  @ApiProperty({ example: 250000, description: 'Refund amount in kobo (cannot exceed order total)' })
  @IsInt()
  @Min(1)
  amountKobo!: number

  @ApiProperty({ example: 'Order arrived 90 min late and food was cold' })
  @IsString()
  @MaxLength(500)
  reason!: string
}

export class DecideRefundDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsString()
  decision!: 'approve' | 'reject'

  @ApiPropertyOptional({ enum: ['original', 'wallet'], description: 'Required when approving' })
  @IsOptional()
  @IsString()
  method?: 'original' | 'wallet'

  @ApiPropertyOptional({ example: 'Approved — partial refund for late delivery' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  decisionNote?: string
}
