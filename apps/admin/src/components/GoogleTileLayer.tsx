'use client'

// Wraps `leaflet.gridlayer.googlemutant` as a react-leaflet child layer so the
// MapPicker can render authentic Google Maps tiles (POI labels, building
// outlines, road classifications) — the "why doesn't it look like Bolt" fix.
//
// The Google Maps JS SDK is loaded on demand via a single script tag; a
// module-level promise dedupes concurrent loads across every mounted picker
// on the page. The SDK requires a browser-visible API key (that's the
// designed use case); security comes from restricting the key in Google
// Cloud Console to:
//   1. HTTP referrers — grandxl.com, admin.grandxl.com, rider.grandxl.com,
//      + your local dev hosts (localhost:5173, localhost:5174, etc).
//   2. Maps JavaScript API only (no Geocoding — that stays on our server
//      via GOOGLE_MAPS_API_KEY).
//
// If the key isn't set, this component renders nothing and the parent falls
// back to Carto tiles.

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.gridlayer.googlemutant'

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY as string | undefined

let loadingPromise: Promise<void> | null = null

function loadGoogleMapsSdk(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.google?.maps) return Promise.resolve()
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps JS SDK failed to load'))
    document.head.appendChild(script)
  }).catch((err) => {
    loadingPromise = null
    throw err
  })
  return loadingPromise
}

export const hasGoogleMapsKey = Boolean(KEY)

interface Props {
  type?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
}

export function GoogleTileLayer({ type = 'roadmap' }: Props) {
  const map = useMap()

  useEffect(() => {
    if (!KEY) return
    let cancelled = false
    let layer: L.Layer | null = null

    void loadGoogleMapsSdk(KEY)
      .then(() => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        layer = (L.gridLayer as any).googleMutant({ type }).addTo(map)
      })
      .catch(() => { /* Fallback to Carto handled by the parent conditional. */ })

    return () => {
      cancelled = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, type])

  return null
}
