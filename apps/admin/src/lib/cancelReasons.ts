import type { CancelReasonCode } from '@grandxl/types'

// Canonical rejection/cancellation reasons offered to the restaurant portal.
// Mirrors the CANCEL_REASON_CODES list in the API DTO. When "other" is picked,
// the UI shows a free-text note field and sends both the code and the note.
export interface CancelReasonOption {
  code: CancelReasonCode
  label: string
  // Whether this reason should collect a free-text note. Always true for
  // "other"; may be optionally used elsewhere for extra context.
  requiresNote?: boolean
}

export const CANCEL_REASON_OPTIONS: CancelReasonOption[] = [
  { code: 'out_of_stock',          label: 'Items out of stock' },
  { code: 'item_unavailable',      label: 'One or more items unavailable' },
  { code: 'too_busy',              label: 'Kitchen too busy right now' },
  { code: 'closing_soon',          label: 'Closing soon — cannot complete' },
  { code: 'outside_delivery_area', label: 'Address outside delivery area' },
  { code: 'duplicate_order',       label: 'Duplicate order' },
  { code: 'customer_request',      label: 'Customer requested cancellation' },
  { code: 'payment_issue',         label: 'Payment issue' },
  { code: 'other',                 label: 'Other', requiresNote: true },
]

export function labelForCode(code: CancelReasonCode | null | undefined): string {
  if (!code) return ''
  return CANCEL_REASON_OPTIONS.find((o) => o.code === code)?.label ?? code
}
