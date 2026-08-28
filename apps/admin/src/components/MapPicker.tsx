'use client'

// S-URGENT-2: reusable map picker for restaurant / rider location capture.
//
// Design: fixed centre pin, map pans underneath. Same pattern Bolt/Uber/Glovo
// use — one-hand friendly on mobile, gives the user visual confirmation that
// the pin is on their actual building. Solves the "Google autocomplete returned
// coordinates for a nearby salon instead of the restaurant" class of bugs by
// requiring an explicit visual placement step.
//
// Bounces reverse-geocode calls at 500ms so a fast drag doesn't hammer the
// Google API. Basemap toggles between street (OSM, free) and satellite (Esri,
// free, permissive attribution) — satellite is essential for rooftop precision
// in dense urban areas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, Map as MapIcon, Satellite } from 'lucide-react'
import { useAuthStore } from '../store/auth.store'

// Fix Leaflet's default icon paths (same fix as DispatchMap)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  // Initial pin position. If null, defaults to Nigeria center — user MUST drag.
  initialLat: number | null
  initialLng: number | null
  onChange: (payload: { lat: number; lng: number; address?: string | null }) => void
  heightPx?: number
}

// Fallback center: rough centroid of Nigeria — used only when caller has no
// prior coords AND no address to geocode from. In practice most callers pass
// initial coords (existing restaurant) or a geocoded starting point (address
// typed in autocomplete).
const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }

// Programmatic recenter — called when the caller passes new initial coords
// (e.g., autocomplete just selected a new address; move the pin there).
function RecenterOnPropChange({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.4 })
  }, [lat, lng, map])
  return null
}

// Fires the onMove callback whenever the map pans/zooms — the center pin is
// stationary so the map center IS the pin's lat/lng.
function CenterTracker({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter()
      onMove(c.lat, c.lng)
    },
  })
  return null
}

export function MapPicker({ initialLat, initialLng, onChange, heightPx = 360 }: Props) {
  const startLat = initialLat ?? NIGERIA_CENTER.lat
  const startLng = initialLng ?? NIGERIA_CENTER.lng
  const startZoom = initialLat != null && initialLng != null ? 17 : 6

  const [currentLat, setCurrentLat] = useState(startLat)
  const [currentLng, setCurrentLng] = useState(startLng)
  const [address, setAddress] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street')
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFired = useRef<string>('') // dedupe: "lat,lng" — reverse-geocode only if changed

  // Fire onChange on every map move (real-time coord capture) + start a
  // debounced reverse-geocode so the address label lags cleanly behind.
  const handleMove = useCallback((lat: number, lng: number) => {
    setCurrentLat(lat)
    setCurrentLng(lng)
    onChange({ lat, lng })

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key === lastFired.current) return
    lastFired.current = key

    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      try {
        // Attach Bearer token — /api/geocode/reverse now requires an admin
        // session (Google-billing protection). Zustand store is the source of
        // truth for the in-memory access token.
        const token = useAuthStore.getState().accessToken
        const res  = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = await res.json() as { result?: { formatted_address?: string } | null }
        const formatted = data.result?.formatted_address ?? null
        setAddress(formatted)
        // Second onChange with the resolved address so the caller can persist
        // or display it. The lat/lng is unchanged from the initial fire.
        onChange({ lat, lng, address: formatted })
      } catch {
        setAddress(null)
      } finally {
        setGeocoding(false)
      }
    }, 500)
  }, [onChange])

  // Sync internal state if caller updates initial coords (e.g., autocomplete
  // pick after mount). The RecenterOnPropChange component below moves the map;
  // this keeps our display state in sync.
  useEffect(() => {
    if (initialLat != null && initialLng != null) {
      setCurrentLat(initialLat)
      setCurrentLng(initialLng)
    }
  }, [initialLat, initialLng])

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
        style={{ height: heightPx }}
      >
        <MapContainer
          center={[startLat, startLng]}
          zoom={startZoom}
          scrollWheelZoom
          className="h-full w-full"
        >
          {basemap === 'street' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> World Imagery'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}
          {initialLat != null && initialLng != null && (
            <RecenterOnPropChange lat={initialLat} lng={initialLng} />
          )}
          <CenterTracker onMove={handleMove} />
        </MapContainer>

        {/* Fixed centre pin — stays put while the map drags underneath. */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div className="flex flex-col items-center -translate-y-3">
            <div
              className="h-10 w-10 rounded-full border-4 border-white bg-orange-600 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
              style={{ borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }}
            />
            <div className="mt-1 h-2 w-2 rounded-full bg-black/40" />
          </div>
        </div>

        {/* Basemap toggle */}
        <div className="absolute top-3 right-3 z-[1000] flex overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5">
          <button
            type="button"
            onClick={() => setBasemap('street')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
              basemap === 'street' ? 'bg-orange-600 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MapIcon size={12} /> Street
          </button>
          <button
            type="button"
            onClick={() => setBasemap('satellite')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
              basemap === 'satellite' ? 'bg-orange-600 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Satellite size={12} /> Satellite
          </button>
        </div>

        {/* Instructions overlay — only on first interaction (no address yet) */}
        {!address && !geocoding && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-16 z-[1000] rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
            Drag the map to place the pin exactly on your restaurant. Switch to satellite for rooftop-precision.
          </div>
        )}
      </div>

      {/* Address strip — shows the reverse-geocoded label as the pin moves */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
        {geocoding ? (
          <>
            <Loader2 size={12} className="animate-spin text-gray-400" />
            <span className="text-gray-500">Looking up address…</span>
          </>
        ) : address ? (
          <>
            <MapIcon size={12} className="shrink-0 text-orange-600" />
            <span className="truncate text-gray-700"><strong>Pin location:</strong> {address}</span>
          </>
        ) : (
          <>
            <MapIcon size={12} className="shrink-0 text-gray-400" />
            <span className="text-gray-500">Move the map to drop a pin.</span>
          </>
        )}
        <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400 tabular-nums">
          {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
        </span>
      </div>
    </div>
  )
}
