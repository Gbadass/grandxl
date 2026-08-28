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
    // Google returns results sorted specific-first for a lat/lng — take the
    // most specific (typically street_address).
    return data.results[0]!
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
