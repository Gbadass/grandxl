import { useEffect } from 'react'
import { mapsApi } from '@grandxl/api-client'
import { useLocationStore } from '../store/location.store'

// Reverse-geocode via the shared /maps proxy — the Google API key stays on
// the server. Returns city/state/display broken down for the location store.
//
// Precision priority (best → worst) for the display string:
//   1. `<street_number> <route>` — "35 Padre Pio Street"
//   2. `route` — "Padre Pio Street" (unmapped house numbers common in Nigeria)
//   3. `sublocality` / `neighborhood` — "Hange"
//   4. `city` — "Asuir" (the old fallback — least precise)
//
// Bolt / Uber show the street-level line by default; without it, riders can't
// find the right building. The `formatted_address` from Google is also stored
// as `display` when finer than our own assembly.
async function reverseGeocode(lat: number, lng: number) {
  try {
    const res    = await mapsApi.reverse(lat, lng)
    const result = res.data.data.result
    const parts  = result?.address_components ?? []
    if (parts.length === 0) return null

    const get = (type: string) => parts.find((c) => c.types.includes(type))?.long_name ?? ''

    const streetNumber = get('street_number')
    const route        = get('route')
    const sublocality  = get('sublocality') || get('sublocality_level_1') || get('neighborhood')
    const city =
      get('locality') ||
      get('sublocality_level_1') ||
      get('administrative_area_level_2') ||
      'Your location'
    const state = get('administrative_area_level_1') || 'Benue'

    // Assemble the tightest display string we can — street > sublocality > city.
    // Fall back on Google's own formatted_address if our components are thin
    // (rural areas where address_components are sparse but formatted_address
    // still has usable text).
    const streetLine =
      (streetNumber && route ? `${streetNumber} ${route}` : route) || sublocality || ''
    const display = streetLine
      ? `${streetLine}, ${city}`
      : (result?.formatted_address?.split(',')[0]?.trim() || city)

    return { city, state, display }
  } catch {
    return null
  }
}

export function useDetectLocation() {
  const coordinates = useLocationStore((s) => s.coordinates)
  const setLocation = useLocationStore((s) => s.setLocation)

  useEffect(() => {
    // Only auto-detect if we don't already have a location
    if (coordinates) return
    if (!navigator.geolocation) return

    // Check if permission was already granted before silently requesting it.
    // This avoids triggering a permission prompt (and browser Violation warnings)
    // on page load. If permission is 'prompt' or 'denied', we wait for the user
    // to explicitly tap "Use my current location" in the address picker.
    void navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state !== 'granted') return

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords
          try {
            const geo = await reverseGeocode(latitude, longitude)
            if (geo) {
              setLocation({ lat: latitude, lng: longitude }, geo.city, geo.display, 'gps', geo.state)
            } else {
              setLocation({ lat: latitude, lng: longitude }, 'Your location', 'Location detected', 'gps', 'Benue')
            }
          } catch {
            setLocation({ lat: latitude, lng: longitude }, 'Your location', 'Location detected', 'gps', 'Benue')
          }
        },
        () => {
          // Unavailable — silently do nothing, user can pick manually
        },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      )
    }).catch(() => {
      // permissions.query not supported — skip silent auto-detect entirely
    })
  }, [])
}

export { reverseGeocode }
