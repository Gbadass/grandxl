export const ORDER_TIMEOUT_QUEUE = 'order-timeout'
export const RIDER_DISPATCH_QUEUE = 'rider-dispatch'
export const SCHEDULED_ORDER_QUEUE = 'scheduled-order-release'
export const SETTLEMENT_QUEUE = 'settlement'

export const ORDER_TIMEOUT_DELAY_MS = 15 * 60 * 1000 // 15 minutes — auto-cancel unpaid order
export const RIDER_DISPATCH_RETRY_DELAY_MS = 2 * 60 * 1000 // 2 minutes between dispatch retries
export const RIDER_DISPATCH_MAX_ATTEMPTS = 5
// Release a scheduled order to the restaurant this many minutes before the
// customer's requested delivery time. Gives the kitchen time to prepare.
export const SCHEDULED_ORDER_PREP_BUFFER_MIN = 45
