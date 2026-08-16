import type { CartItem } from '@grandxl/types'

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
}

const CURRENCY_KOBO_FACTOR: Record<string, number> = {
  NGN: 100, // 100 kobo = ₦1
  GHS: 100, // 100 pesewa = GH₵1
  KES: 100, // 100 cents = KSh1
}

export function formatMoney(amountKobo: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency
  const factor = CURRENCY_KOBO_FACTOR[currency] ?? 100
  const majorAmount = amountKobo / factor

  return `${symbol}${majorAmount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function koboToNaira(kobo: number): number {
  return kobo / 100
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100)
}

export function calculateItemTotal(item: CartItem): number {
  const variantTotal = item.selectedVariants.reduce(
    (sum, v) => sum + v.priceAdjustment,
    0,
  )
  const addOnTotal = item.selectedAddOns.reduce((sum, a) => sum + a.price, 0)
  return (item.basePrice + variantTotal + addOnTotal) * item.quantity
}

export function calculateOrderTotal(
  items: CartItem[],
  deliveryFee: number,
  serviceFee: number,
  discount: number,
): {
  subtotal: number
  deliveryFee: number
  serviceFee: number
  discount: number
  total: number
} {
  const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0)
  const total = subtotal + deliveryFee + serviceFee - discount
  return { subtotal, deliveryFee, serviceFee, discount, total: Math.max(0, total) }
}
