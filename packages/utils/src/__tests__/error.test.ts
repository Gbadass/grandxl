import { describe, it, expect } from 'vitest'
import { parseApiError } from '../error'

describe('parseApiError', () => {
  it('returns fallback for null/undefined', () => {
    expect(parseApiError(null)).toBe('Something went wrong. Please try again.')
    expect(parseApiError(undefined)).toBe('Something went wrong. Please try again.')
  })

  it('returns network error message for ERR_NETWORK', () => {
    expect(parseApiError({ code: 'ERR_NETWORK' })).toBe(
      'No internet connection. Please check your network.',
    )
  })

  it('returns timeout message for ETIMEDOUT', () => {
    expect(parseApiError({ code: 'ETIMEDOUT' })).toBe('Request timed out. Please try again.')
  })

  it('extracts string message from response', () => {
    const err = { response: { data: { message: 'Invalid OTP' } } }
    expect(parseApiError(err)).toBe('Invalid OTP')
  })

  it('extracts first message from array', () => {
    const err = { response: { data: { message: ['First error', 'Second error'] } } }
    expect(parseApiError(err)).toBe('First error')
  })

  it('extracts from errors array', () => {
    const err = { response: { data: { errors: ['Phone is required'] } } }
    expect(parseApiError(err)).toBe('Phone is required')
  })

  it('returns fallback for unrecognized shape', () => {
    expect(parseApiError({ someRandomField: true })).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
