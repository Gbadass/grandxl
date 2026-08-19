export const ORDER_TIMEOUT_QUEUE = 'order-timeout'
export const RIDER_DISPATCH_QUEUE = 'rider-dispatch'
export const SCHEDULED_ORDER_QUEUE = 'scheduled-order-release'
export const SETTLEMENT_QUEUE = 'settlement'

export const ORDER_TIMEOUT_DELAY_MS = 15 * 60 * 1000 // 15 minutes — auto-cancel unpaid order
export const RIDER_DISPATCH_RETRY_DELAY_MS = 2 * 60 * 1000 // 2 minutes (used for fixed-delay fallback only)
// Exponential base: 30s → 60s → 120s → 240s → 480s (≈ 15 min total across 5 attempts)
export const RIDER_DISPATCH_BACKOFF_BASE_MS = 30 * 1000
export const RIDER_DISPATCH_MAX_ATTEMPTS = 5
// Release a scheduled order to the restaurant this many minutes before the
// customer's requested delivery time. Gives the kitchen time to prepare.
export const SCHEDULED_ORDER_PREP_BUFFER_MIN = 45
