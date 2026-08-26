import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus } from '@grandxl/types'

// Kept in-file (rather than imported) so class-validator has a plain array to
// check against — `@IsIn` needs concrete values, not just a TS type. Any change
// here must be mirrored in `CancelReasonCode` in packages/types.
const CANCEL_REASON_CODES = [
  'out_of_stock',
  'item_unavailable',
  'too_busy',
  'closing_soon',
  'outside_delivery_area',
  'duplicate_order',
  'customer_request',
  'payment_issue',
  'other',
] as const

// Server-side default free-text used when the caller sends a code but no note.
// The restaurant portal already fills `cancelReason` from the code label, but
// legacy callers (mobile, older admin builds) may only send a code — this is
// what the customer will see in that case.
export const CANCEL_REASON_TEXT: Record<(typeof CANCEL_REASON_CODES)[number], string> = {
  out_of_stock:          'Items out of stock',
  item_unavailable:      'One or more items unavailable',
  too_busy:              'Restaurant too busy right now',
  closing_soon:          "Restaurant is closing and can't complete this order",
  outside_delivery_area: 'Address is outside our delivery area',
  duplicate_order:       'Duplicate order',
  customer_request:      'Customer requested cancellation',
  payment_issue:         'Payment could not be verified',
  other:                 'Cancelled by restaurant',
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus

  @ApiPropertyOptional({ example: 'Customer requested cancellation', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cancelReason?: string

  @ApiPropertyOptional({
    enum: CANCEL_REASON_CODES,
    description: 'Canonical code for the cancellation. Enables analytics + i18n messaging to the customer.',
  })
  @IsOptional()
  @IsIn(CANCEL_REASON_CODES)
  cancelReasonCode?: (typeof CANCEL_REASON_CODES)[number]

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
