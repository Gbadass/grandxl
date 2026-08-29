import { Controller, Get, Query, Header } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger'
import { MapsService } from './maps.service'
import { Public } from '../../common/decorators/public.decorator'

// Server-side proxy for Google Maps. Two reasons this lives here rather than
// in each frontend app:
//   1. Key hiding — the Google API key never lands in a client bundle. Web +
//      admin call these endpoints with the shared Bearer/no-auth pattern below.
//   2. Central rate limiting — one billed key, one budget. Global @Throttle
//      tiers protect the budget from a runaway client OR abuse from a leaked
//      admin session token.
//
// Endpoints:
//   GET /maps/reverse             — auth required (only ever called from the
//                                   MapPicker on authed pages).
//   GET /maps/places/autocomplete — public (register/signup use it pre-session).
//   GET /maps/places/details      — public (same).
@ApiTags('Maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly maps: MapsService) {}

  // Reverse-geocode a lat/lng to a formatted address. Debounced from the map
  // picker as the user drags — 30/min per user is plenty; anything higher is
  // an abuse pattern.
  @Get('reverse')
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60')
  @ApiOperation({ summary: 'Reverse-geocode a lat/lng pair (auth required)' })
  @ApiQuery({ name: 'lat', required: true, type: String })
  @ApiQuery({ name: 'lng', required: true, type: String })
  @ApiOkResponse({ description: 'The most specific address result, or null' })
  async reverse(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ): Promise<{ result: unknown | null }> {
    if (!lat?.trim() || !lng?.trim()) return { result: null }
    const result = await this.maps.reverseGeocode(lat.trim(), lng.trim())
    return { result }
  }

  // Autocomplete for the address input. Public because customer/restaurant
  // signup flows call this before the user has a session. Tighter throttle
  // than the global default so a rotating-IP scrape can't drain the quota.
  @Get('places/autocomplete')
  @Public()
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Autocomplete address suggestions (public)' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiOkResponse({ description: 'Ordered predictions from Google Places' })
  async autocomplete(
    @Query('q') q?: string,
  ): Promise<{ suggestions: Array<{ description: string; place_id: string }> }> {
    const trimmed = q?.trim() ?? ''
    if (trimmed.length < 2) return { suggestions: [] }
    const suggestions = await this.maps.placesAutocomplete(trimmed)
    return { suggestions }
  }

  // Details lookup for a place_id (address, components, geometry). Same
  // public + throttle rationale as autocomplete — they're always paired.
  @Get('places/details')
  @Public()
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Place details incl. geometry (public)' })
  @ApiQuery({ name: 'placeId', required: true, type: String })
  @ApiOkResponse({ description: 'Google place details or null' })
  async details(
    @Query('placeId') placeId?: string,
  ): Promise<{ result: unknown | null }> {
    if (!placeId?.trim()) return { result: null }
    const result = await this.maps.placeDetails(placeId.trim())
    return { result }
  }

  // Forward-geocode free-text address → coordinates. Used by the restaurant
  // signup wizard to pin the new business without exposing the Google API
  // key to the browser. Public because signup runs pre-session.
  @Get('geocode')
  @Public()
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Forward-geocode an address to a lat/lng (public)' })
  @ApiQuery({ name: 'address', required: true, type: String })
  @ApiOkResponse({ description: 'Google geocode result or null' })
  async geocode(
    @Query('address') address?: string,
  ): Promise<{ result: unknown | null }> {
    if (!address?.trim()) return { result: null }
    const result = await this.maps.geocode(address.trim())
    return { result }
  }
}
