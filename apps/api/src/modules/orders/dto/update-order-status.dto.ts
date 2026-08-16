import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus } from '@grandxl/types'

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus

  @ApiPropertyOptional({ example: 'Customer requested cancellation', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancelReason?: string
}
