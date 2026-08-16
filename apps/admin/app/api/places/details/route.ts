import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId')?.trim()
  if (!placeId) return NextResponse.json({ result: null })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return NextResponse.json({ error: 'Maps key not configured' }, { status: 500 })

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=address_component,formatted_address` +
    `&language=en` +
    `&key=${key}`

  const res  = await fetch(url)
  const data = await res.json() as {
    status: string
    result?: {
      formatted_address?: string
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
    }
    error_message?: string
  }

  if (data.status !== 'OK') {
    console.error('[Places details]', data.status, data.error_message)
    return NextResponse.json({ result: null, status: data.status })
  }

  return NextResponse.json({ result: data.result })
}
