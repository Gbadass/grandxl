import { getClient } from '../client'
import type { ApiResponse } from '@grandxl/types'

// Client for the NestJS /maps proxy — the Google API key stays server-side.
// Both admin and web use these; auth headers are attached automatically by
// the shared axios instance (Bearer token for reverse-geocode, no auth for
// the two public places endpoints).

export interface MapsAutocompleteSuggestion {
  description: string
  place_id:    string
}

export interface MapsGeocodeResult {
  formatted_address?: string
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
  geometry?:          { location?: { lat: number; lng: number } }
}

export const mapsApi = {
  // Reverse-geocode a lat/lng pair. Requires an authed session (super-admin
  // or authenticated user) — enforced by the API's global JwtAuthGuard.
  reverse: (lat: number | string, lng: number | string) =>
    getClient().get<ApiResponse<{ result: MapsGeocodeResult | null }>>('/maps/reverse', {
      params: { lat: String(lat), lng: String(lng) },
    }),

  // Address autocomplete. Public — called from signup / register flows before
  // the user has a session.
  placesAutocomplete: (q: string) =>
    getClient().get<ApiResponse<{ suggestions: MapsAutocompleteSuggestion[] }>>('/maps/places/autocomplete', {
      params: { q },
    }),

  // Place details lookup for a place_id. Public for the same signup reason.
  placeDetails: (placeId: string) =>
    getClient().get<ApiResponse<{ result: MapsGeocodeResult | null }>>('/maps/places/details', {
      params: { placeId },
    }),

  // Forward-geocode a free-text address → coordinates. Public.
  geocode: (address: string) =>
    getClient().get<ApiResponse<{ result: MapsGeocodeResult | null }>>('/maps/geocode', {
      params: { address },
    }),
}
