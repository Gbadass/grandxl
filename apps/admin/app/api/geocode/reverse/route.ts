import { NextRequest, NextResponse } from 'next/server'

// S-URGENT-2 (map picker): reverse-geocode a lat/lng pair to a
// human-readable address. Called (debounced) as the owner drags the map so
// the picker's address strip stays in sync with the pin location. Cached at
// the CDN edge for 60s so quick back-and-forth drags don't hammer the API.
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')?.trim()
  const lng = request.nextUrl.searchParams.get('lng')?.trim()
  if (!lat || !lng) return NextResponse.json({ result: null })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return NextResponse.json({ error: 'Maps key not configured' }, { status: 500 })

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}` +
    `&language=en` +
    `&key=${key}`

  const res = await fetch(url)
  const data = await res.json() as {
    status: string
    results?: Array<{
      formatted_address?: string
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
    }>
    error_message?: string
  }

  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json({ result: null, status: data.status })
  }

  // Pick the most specific result (Google returns them sorted specific-first
  // for a lat/lng — typically street_address, then neighborhood, then locality).
  const top = data.results[0]!
  return NextResponse.json(
    { result: top },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
  )
}
