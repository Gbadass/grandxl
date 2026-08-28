export const ORDER_TIMEOUT_QUEUE = 'order-timeout'
export const RIDER_DISPATCH_QUEUE = 'rider-dispatch'
export const SCHEDULED_ORDER_QUEUE = 'scheduled-order-release'
export const SETTLEMENT_QUEUE = 'settlement'
// S-URGENT (Nigerian ack flow): T+90s "restaurant hasn't engaged yet, dispatch
// anyway" fallback. Job is enqueued at payment-complete / cash-order-create
// with jobId=`escalation-{orderId}` so a restaurant Accept can cancel it via
// queue.remove(jobId) — the immediate dispatch fires instead.
export const DISPATCH_ESCALATION_QUEUE = 'dispatch-escalation'
export const DISPATCH_ESCALATION_DELAY_MS = 90 * 1000

export const ORDER_TIMEOUT_DELAY_MS = 30 * 60 * 1000 // 30 minutes — auto-cancel unpaid order
export const RIDER_DISPATCH_RETRY_DELAY_MS = 2 * 60 * 1000 // 2 minutes (used for fixed-delay fallback only)
// Exponential base: 60s → 120s → 240s → 480s → 960s (≈ 31 min total across 5 attempts)
// Must be > OFFER_SECONDS (45s) so every offer in round N expires before round N+1 fires.
// This guarantees declinedBy is fully populated when the next broadcast builds its list.
export const RIDER_DISPATCH_BACKOFF_BASE_MS = 60 * 1000
export const RIDER_DISPATCH_MAX_ATTEMPTS = 5
// Release a scheduled order to the restaurant this many minutes before the
// customer's requested delivery time. Gives the kitchen time to prepare.
export const SCHEDULED_ORDER_PREP_BUFFER_MIN = 45
