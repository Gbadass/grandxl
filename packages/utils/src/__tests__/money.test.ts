import { describe, it, expect } from 'vitest'
import { formatMoney, koboToNaira, nairaToKobo, calculateItemTotal, calculateOrderTotal } from '../money'
import type { CartItem } from '@grandxl/types'

const makeItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  menuItemId: 'abc123',
  restaurantId: 'rest123',
  name: 'Jollof Rice',
  image: null,
  basePrice: 150000,
  quantity: 1,
  selectedVariants: [],
  selectedAddOns: [],
  itemTotal: 150000,
  note: null,
  ...overrides,
})

describe('formatMoney', () => {
  it('formats NGN correctly', () => {
    expect(formatMoney(150000, 'NGN')).toBe('₦1,500.00')
  })

  it('formats GHS correctly', () => {
    expect(formatMoney(150000, 'GHS')).toBe('GH₵1,500.00')
  })

  it('formats zero correctly', () => {
    expect(formatMoney(0, 'NGN')).toBe('₦0.00')
  })
})

describe('koboToNaira', () => {
  it('converts correctly', () => {
    expect(koboToNaira(150000)).toBe(1500)
    expect(koboToNaira(100)).toBe(1)
  })
})

describe('nairaToKobo', () => {
  it('converts correctly', () => {
    expect(nairaToKobo(1500)).toBe(150000)
    expect(nairaToKobo(1)).toBe(100)
  })
})

describe('calculateItemTotal', () => {
  it('calculates base price × quantity', () => {
    expect(calculateItemTotal(makeItem({ quantity: 2 }))).toBe(300000)
  })

  it('adds variant price adjustments', () => {
    const item = makeItem({
      selectedVariants: [{ variantName: 'Size', optionName: 'Large', priceAdjustment: 10000 }],
    })
    expect(calculateItemTotal(item)).toBe(160000)
  })

  it('adds add-on prices', () => {
    const item = makeItem({
      selectedAddOns: [{ name: 'Extra Cheese', price: 3000 }],
    })
    expect(calculateItemTotal(item)).toBe(153000)
  })

  it('combines variants, add-ons, and quantity', () => {
    const item = makeItem({
      quantity: 2,
      selectedVariants: [{ variantName: 'Size', optionName: 'Large', priceAdjustment: 10000 }],
      selectedAddOns: [{ name: 'Extra Sauce', price: 1500 }],
    })
    expect(calculateItemTotal(item)).toBe((150000 + 10000 + 1500) * 2)
  })
})

describe('calculateOrderTotal', () => {
  it('calculates totals correctly', () => {
    const items = [makeItem({ basePrice: 200000, quantity: 1 })]
    const result = calculateOrderTotal(items, 100000, 15000, 0)
    expect(result.subtotal).toBe(200000)
    expect(result.deliveryFee).toBe(100000)
    expect(result.serviceFee).toBe(15000)
    expect(result.discount).toBe(0)
    expect(result.total).toBe(315000)
  })

  it('applies discount correctly', () => {
    const items = [makeItem({ basePrice: 200000, quantity: 1 })]
    const result = calculateOrderTotal(items, 0, 0, 50000)
    expect(result.total).toBe(150000)
  })

  it('never returns negative total', () => {
    const items = [makeItem({ basePrice: 100, quantity: 1 })]
    const result = calculateOrderTotal(items, 0, 0, 100000)
    expect(result.total).toBe(0)
  })
})
