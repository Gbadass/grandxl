import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DisputeStatus, DisputeType } from '../schemas/dispute.schema'

export class CreateDisputeDto {
  @ApiProperty({ example: '665f1b2c3d4e5f6789abcdef', description: 'ID of the order being disputed' })
  @IsString()
  orderId!: string

  @ApiProperty({ enum: DisputeType })
  @IsEnum(DisputeType)
  type!: DisputeType

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @Length(10, 1000)
  description!: string
}

export class UpdateDisputeDto {
  @ApiPropertyOptional({ enum: DisputeStatus })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus

  @ApiPropertyOptional({ example: 'Refund issued for missing items' })
  @IsOptional()
  @IsString()
  resolution?: string
}
