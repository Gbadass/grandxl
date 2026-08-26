import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
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

  // Required by the server when marking a CASH order DELIVERED. The rider PWA
  // shows a confirmation modal ("did you collect ₦X?") and forwards true here.
  // If the rider didn't collect, they open a dispute instead — not this flag.
  @ApiPropertyOptional({ description: 'Rider confirms cash was collected (COD only)' })
  @IsOptional()
  @IsBoolean()
  cashCollected?: boolean

  // Cloudinary URL from POST /uploads/delivery-proof. REQUIRED for COD DELIVERED
  // transitions; optional but encouraged for card. Rendered in admin dispute view.
  @ApiPropertyOptional({ description: 'Cloudinary URL of delivery proof photo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryProofUrl?: string
}
