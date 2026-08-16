import { describe, it, expect } from 'vitest'
import { slugify, generateOrderNumber, truncate, capitalize } from '../string'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Chicken Republic Lagos Island')).toBe('chicken-republic-lagos-island')
  })

  it('removes special characters', () => {
    expect(slugify("Mama's Kitchen & Grill!")).toBe('mamas-kitchen-grill')
  })

  it('collapses multiple spaces/hyphens', () => {
    expect(slugify('Hello   World')).toBe('hello-world')
  })
})

describe('generateOrderNumber', () => {
  it('generates correct format', () => {
    const date = new Date('2024-12-15')
    const result = generateOrderNumber(date, 42)
    expect(result).toBe('GXL-20241215-0042')
  })

  it('pads sequence to 4 digits', () => {
    const date = new Date('2024-01-01')
    expect(generateOrderNumber(date, 1)).toBe('GXL-20240101-0001')
  })
})

describe('truncate', () => {
  it('returns string unchanged when under limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('truncates and adds ellipsis', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...')
  })
})

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('lowercases the rest', () => {
    expect(capitalize('HELLO WORLD')).toBe('Hello world')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })
})
