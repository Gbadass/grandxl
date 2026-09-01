import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

// Google Maps proxy service. Keeps the Google API key server-side so client
// bundles (admin, web) don't ship it. Deploy A of the map-picker migration:
// admin still uses its own /api/geocode/* Next.js routes today; once this
// module is live and verified, both admin and web will point here (Deploy B).

interface GeocodeResult {
  formatted_address?: string
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
  geometry?: { location?: { lat: number; lng: number } }
}

interface AutocompletePrediction {
  description: string
  place_id: string
}

// Google Plus Code alphabet — https://en.wikipedia.org/wiki/Open_Location_Code.
// Matches a leading "XXXX+XX," (4–8 chars, '+', 2–3 chars) at the start of a
// formatted_address, which is how Google represents "no street address here".
const PLUS_CODE_PREFIX = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}(?:,\s*|$)/i

function hasPlusCodePrefix(address: string): boolean {
  return PLUS_CODE_PREFIX.test(address)
}

function stripPlusCodePrefix(address: string): string {
  return address.replace(PLUS_CODE_PREFIX, '')
}

// Equirectangular approximation — accurate to <1m at the sub-hundred-metre
// scales we care about (Places-Nearby validation), and avoids importing a
// full haversine util for one comparison.
function approxDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const x = toRad(lng2 - lng1) * Math.cos(toRad((lat1 + lat2) / 2))
  const y = toRad(lat2 - lat1)
  return Math.sqrt(x * x + y * y) * R
}

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name)

  constructor(private readonly config: ConfigService) {}

  private key(): string {
    const k = this.config.get<string>('GOOGLE_MAPS_API_KEY')
    if (!k) {
      // Fail closed rather than proxy-with-no-key: an empty key returns
      // REQUEST_DENIED and burns quota without producing useful results.
      throw new ServiceUnavailableException('Maps service not configured')
    }
    return k
  }

  async reverseGeocode(lat: string, lng: string): Promise<GeocodeResult | null> {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
      `&language=en` +
      `&key=${this.key()}`

    const res = await fetch(url)
    const data = await res.json() as {
      status: string
      results?: GeocodeResult[]
      error_message?: string
    }

    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status !== 'ZERO_RESULTS') {
        this.logger.warn(`Google reverse-geocode ${data.status}: ${data.error_message ?? ''}`)
      }
      return null
    }
    const result = data.results[0]!
    const formatted = result.formatted_address ?? ''

    // Google's reverse-geocode returns a Plus Code as the "address" when no
    // street address is registered for these coords — extremely common across
    // informal-street areas in Nigeria (e.g., "PG7J+Q4Q, High Level, Makurdi").
    // Plus Codes are opaque to end users, so we swap in the nearest business
    // name via Places whenever the pin is on/near a known establishment.
    if (formatted && hasPlusCodePrefix(formatted)) {
      const cleaned = stripPlusCodePrefix(formatted)
      const poi = await this.placesNearestEstablishment(lat, lng).catch(() => null)
      // 40m cap: further than that and we start attaching a *neighbouring*
      // building's name to the pin, which is worse than the plain address.
      result.formatted_address = poi && poi.distanceM <= 40
        ? `${poi.name}, ${cleaned}`
        : cleaned
    }
    return result
  }

  // Nearest business/POI to a lat/lng via Places Nearby Search, ranked by
  // distance. Returns null when Google has no establishments indexed nearby.
  private async placesNearestEstablishment(
    lat: string,
    lng: string,
  ): Promise<{ name: string; distanceM: number } | null> {
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
      `&rankby=distance` +
      `&type=establishment` +
      `&language=en` +
      `&key=${this.key()}`

    const res = await fetch(url)
    const data = await res.json() as {
      status: string
      results?: Array<{
        name?: string
        geometry?: { location?: { lat: number; lng: number } }
      }>
      error_message?: string
    }
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status !== 'ZERO_RESULTS') {
        this.logger.warn(`Google places-nearby ${data.status}: ${data.error_message ?? ''}`)
      }
      return null
    }
    const top = data.results[0]!
    const loc = top.geometry?.location
    if (!top.name || !loc) return null
    return {
      name: top.name,
      distanceM: approxDistanceMeters(Number(lat), Number(lng), loc.lat, loc.lng),
    }
  }

  async placesAutocomplete(q: string): Promise<AutocompletePrediction[]> {
    // Nigeria-scoped autocomplete — matches the country the platform serves.
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(q)}` +
      `&components=country:ng` +
      `&types=geocode` +
      `&language=en` +
      `&key=${this.key()}`

    const res  = await fetch(url)
    const data = await res.json() as {
      status: string
      predictions?: AutocompletePrediction[]
      error_message?: string
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Google places-autocomplete ${data.status}: ${data.error_message ?? ''}`)
      return []
    }
    return (data.predictions ?? []).map((p) => ({
      description: p.description,
      place_id:    p.place_id,
    }))
  }

  // Forward-geocode a free-text address to a lat/lng. Called from the
  // restaurant signup flow to pin the new restaurant on the map without
  // shipping the Google API key to the client.
  async geocode(address: string): Promise<GeocodeResult | null> {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address)}` +
      `&region=ng` +
      `&language=en` +
      `&key=${this.key()}`

    const res  = await fetch(url)
    const data = await res.json() as {
      status: string
      results?: GeocodeResult[]
      error_message?: string
    }
    if (data.status !== 'OK' || !data.results?.length) {
      if (data.status !== 'ZERO_RESULTS') {
        this.logger.warn(`Google forward-geocode ${data.status}: ${data.error_message ?? ''}`)
      }
      return null
    }
    return data.results[0]!
  }

  async placeDetails(placeId: string): Promise<GeocodeResult | null> {
    // geometry/location included so the map picker can drop its initial pin
    // exactly where Google places the address, without an extra geocode call.
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=address_component,formatted_address,geometry/location` +
      `&language=en` +
      `&key=${this.key()}`

    const res  = await fetch(url)
    const data = await res.json() as {
      status: string
      result?: GeocodeResult
      error_message?: string
    }

    if (data.status !== 'OK' || !data.result) {
      this.logger.warn(`Google place-details ${data.status}: ${data.error_message ?? ''}`)
      return null
    }
    return data.result
  }
}
