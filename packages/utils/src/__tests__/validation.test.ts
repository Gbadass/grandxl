import { describe, it, expect } from 'vitest'
import { isValidObjectId, maskEmail } from '../validation'
import { maskPhone } from '../phone'

describe('isValidObjectId', () => {
  it('accepts valid 24-char hex', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true)
  })

  it('rejects short strings', () => {
    expect(isValidObjectId('abc123')).toBe(false)
  })

  it('rejects non-hex characters', () => {
    expect(isValidObjectId('507f1f77bcf86cd79943901z')).toBe(false)
  })
})

describe('maskPhone', () => {
  it('masks middle digits', () => {
    expect(maskPhone('+2348012345678')).toBe('+234***5678')
  })
})

describe('maskEmail', () => {
  it('masks local part after first char', () => {
    expect(maskEmail('gerald@gmail.com')).toBe('g****@gmail.com')
  })

  it('handles email without @', () => {
    expect(maskEmail('notanemail')).toBe('***')
  })
})
