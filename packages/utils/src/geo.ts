import type { GeoJSONPoint } from '@grandxl/types'

const EARTH_RADIUS_KM = 6371

export function calculateDistance(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180

  const dLat = toRad(p2.lat - p1.lat)
  const dLng = toRad(p2.lng - p1.lng)
  const lat1 = toRad(p1.lat)
  const lat2 = toRad(p2.lat)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = EARTH_RADIUS_KM * c

  return Math.round(distance * 100) / 100
}

export function isWithinRadius(
  center: { lat: number; lng: number },
  point: { lat: number; lng: number },
  radiusKm: number,
): boolean {
  return calculateDistance(center, point) <= radiusKm
}

// GeoJSON uses [longitude, latitude] — NOT [latitude, longitude]
export function toGeoJSON(lat: number, lng: number): GeoJSONPoint {
  return { type: 'Point', coordinates: [lng, lat] }
}

export function fromGeoJSON(point: GeoJSONPoint): { lat: number; lng: number } {
  return { lat: point.coordinates[1], lng: point.coordinates[0] }
}

export function bearingBetween(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const toDeg = (rad: number): number => (rad * 180) / Math.PI

  const dLng = toRad(p2.lng - p1.lng)
  const lat1 = toRad(p1.lat)
  const lat2 = toRad(p2.lat)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360
  return Math.round(bearing)
}
