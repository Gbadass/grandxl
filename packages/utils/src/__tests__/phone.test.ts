import { describe, it, expect } from 'vitest'
import { formatPhone, toE164, isValidPhone, maskPhone } from '../phone'

describe('formatPhone', () => {
  it('formats Nigerian number', () => {
    expect(formatPhone('+2348012345678')).toBe('0801 234 5678')
  })

  it('formats Ghanaian number', () => {
    expect(formatPhone('+233201234567')).toBe('020 123 4567')
  })

  it('returns unknown formats unchanged', () => {
    expect(formatPhone('+12025551234')).toBe('+12025551234')
  })
})

describe('toE164', () => {
  it('converts Nigerian local to E.164', () => {
    expect(toE164('08012345678', 'NG')).toBe('+2348012345678')
  })

  it('returns already-E164 number unchanged', () => {
    expect(toE164('+2348012345678', 'NG')).toBe('+2348012345678')
  })

  it('throws for invalid format', () => {
    expect(() => toE164('1234', 'NG')).toThrow()
  })

  it('throws for unsupported country', () => {
    expect(() => toE164('08012345678', 'ZZ')).toThrow()
  })
})

describe('isValidPhone', () => {
  it('accepts valid E.164', () => {
    expect(isValidPhone('+2348012345678')).toBe(true)
  })

  it('rejects local format', () => {
    expect(isValidPhone('08012345678')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidPhone('')).toBe(false)
  })
})

describe('maskPhone', () => {
  it('masks Nigerian number correctly', () => {
    expect(maskPhone('+2348012345678')).toBe('+234***5678')
  })

  it('handles short strings gracefully', () => {
    expect(maskPhone('12')).toBe('***')
  })
})
