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
// v0.16 is pure ESM. The package's `browser` field points at an old IIFE build
// that assumes `window.L` exists — webpack picks that and hands us undefined.
// Deep-import the .mjs source to force the ES module build in both webpack (Next)
// and Vite (Web). The class is a GridLayer subclass — `new`-able directly.
import GoogleMutant from 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs'

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

// Runtime fallback: if the Google SDK script is rejected (bad referrer, API
// not enabled, invalid key, billing issue), attach a Carto tile layer directly
// to the Leaflet map so the picker isn't left blank. The Carto URL depends on
// the requested `type` — roadmap → voyager, satellite/hybrid → arcgis imagery.
function attachCartoFallback(map: L.Map, type: Props['type']): L.Layer {
  if (type === 'satellite' || type === 'hybrid') {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri World Imagery', maxZoom: 19 },
    ).addTo(map)
  }
  return L.tileLayer(
    // Path is /rastertiles/voyager/ — Carto silently retired the shorter
    // /voyager/ endpoint (returns 404 for everything, including 0/0/0).
    // {r} restores retina @2x tiles for crisp maps on high-DPI displays.
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; CARTO &copy; OpenStreetMap',
      subdomains: ['a', 'b', 'c', 'd'],
      maxZoom: 20,
    },
  ).addTo(map)
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
        layer = new GoogleMutant({ type }).addTo(map)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[GoogleTileLayer] Google tiles failed, falling back to Carto:', err)
        layer = attachCartoFallback(map, type)
      })

    return () => {
      cancelled = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, type])

  return null
}
