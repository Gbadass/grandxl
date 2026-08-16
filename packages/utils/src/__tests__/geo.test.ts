import { describe, it, expect } from 'vitest'
import { calculateDistance, isWithinRadius, toGeoJSON, fromGeoJSON, bearingBetween } from '../geo'

// Victoria Island, Lagos
const VICTORIA_ISLAND = { lat: 6.4281, lng: 3.4219 }
// Lekki Phase 1, Lagos (~7km from VI)
const LEKKI = { lat: 6.4474, lng: 3.5133 }

describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(VICTORIA_ISLAND, VICTORIA_ISLAND)).toBe(0)
  })

  it('calculates reasonable distance between Lagos landmarks', () => {
    const dist = calculateDistance(VICTORIA_ISLAND, LEKKI)
    expect(dist).toBeGreaterThan(5)
    expect(dist).toBeLessThan(12)
  })

  it('is symmetric', () => {
    const d1 = calculateDistance(VICTORIA_ISLAND, LEKKI)
    const d2 = calculateDistance(LEKKI, VICTORIA_ISLAND)
    expect(d1).toBe(d2)
  })
})

describe('isWithinRadius', () => {
  it('returns true when within radius', () => {
    expect(isWithinRadius(VICTORIA_ISLAND, VICTORIA_ISLAND, 1)).toBe(true)
  })

  it('returns false when outside radius', () => {
    expect(isWithinRadius(VICTORIA_ISLAND, LEKKI, 1)).toBe(false)
  })
})

describe('toGeoJSON / fromGeoJSON', () => {
  it('round-trips correctly', () => {
    const point = toGeoJSON(6.4281, 3.4219)
    expect(point.type).toBe('Point')
    expect(point.coordinates).toEqual([3.4219, 6.4281]) // [lng, lat]

    const back = fromGeoJSON(point)
    expect(back.lat).toBe(6.4281)
    expect(back.lng).toBe(3.4219)
  })
})

describe('bearingBetween', () => {
  it('returns a value between 0 and 360', () => {
    const bearing = bearingBetween(VICTORIA_ISLAND, LEKKI)
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThanOrEqual(360)
  })
})
