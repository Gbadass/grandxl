import { NextRequest, NextResponse } from 'next/server'
import { rateLimitByIp } from '../../../src/lib/apiAuth'

// Places autocomplete proxy. Public — the /auth/register page uses this before
// the user has a session, so we can't require auth. Rate-limit by IP instead
// to prevent script-hammering that would burn our Google Places budget.
// The limit is intentionally generous: legitimate typing hits this at every
// keystroke, so 120/min per IP still leaves plenty of headroom.
export async function GET(request: NextRequest) {
  const limited = rateLimitByIp(request, 'places-autocomplete', 120, 60_000)
  if (limited) return limited

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return NextResponse.json({ error: 'Maps key not configured' }, { status: 500 })

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(q)}` +
    `&components=country:ng` +
    `&types=geocode` +
    `&language=en` +
    `&key=${key}`

  const res  = await fetch(url)
  const data = await res.json() as {
    status: string
    predictions?: Array<{ description: string; place_id: string }>
    error_message?: string
  }

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[Places autocomplete]', data.status, data.error_message)
    return NextResponse.json({ suggestions: [], status: data.status }, { status: 200 })
  }

  return NextResponse.json({
    suggestions: (data.predictions ?? []).map((p) => ({
      description: p.description,
      place_id:    p.place_id,
    })),
  })
}
