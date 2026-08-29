// Reusable map picker for customer delivery-address capture.
//
// Same component as apps/admin/src/components/MapPicker.tsx — copied per
// CLAUDE.md rule ("packages/ui shares tokens only — NOT component code").
// Both use the same shared /maps backend (via @grandxl/api-client) so the
// Google API key stays server-side.
//
// Design: fixed centre pin, map pans underneath — Bolt/Uber/Glovo pattern.
// One-hand friendly on mobile, gives the user visual confirmation that the
// pin is on their actual building. Debounces reverse-geocode at 500ms so a
// fast drag doesn't hammer the API. Basemap toggles between street (OSM)
// and satellite (Esri) — satellite is essential for rooftop precision in
// dense urban areas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, Map as MapIcon, Satellite, Maximize2, Check, X } from 'lucide-react'
import { mapsApi } from '@grandxl/api-client'

// Fix Leaflet's default icon paths — bundler swaps its internal image URLs.
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

const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }

// Programmatic recenter when the caller passes new initial coords (e.g. an
// autocomplete pick). Feedback-loop guard: after every drag, handleMove emits
// onChange({lat,lng}) which the parent typically writes back and passes down
// as initialLat/initialLng. Without the guard, that echo triggers setView,
// which cancels the user's in-progress gesture — the map visibly bounces back.
function RecenterOnPropChange({
  lat, lng, lastEmittedRef,
}: {
  lat: number
  lng: number
  lastEmittedRef: React.MutableRefObject<{ lat: number; lng: number } | null>
}) {
  const map = useMap()
  useEffect(() => {
    const last = lastEmittedRef.current
    // ~1e-5 degrees ≈ 1.1 meters — safely above float-round noise from the
    // getCenter → setView cycle, well below drag precision.
    if (last && Math.abs(last.lat - lat) < 1e-5 && Math.abs(last.lng - lng) < 1e-5) {
      return
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 16), { animate: true, duration: 0.4 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, map])
  return null
}

// Fires onMove whenever the map pans/zooms — the center pin is stationary
// so the map center IS the pin's lat/lng.
function CenterTracker({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter()
      onMove(c.lat, c.lng)
    },
  })
  return null
}

export function MapPicker({ initialLat, initialLng, onChange, heightPx = 320 }: Props) {
  const startLat = initialLat ?? NIGERIA_CENTER.lat
  const startLng = initialLng ?? NIGERIA_CENTER.lng
  const startZoom = initialLat != null && initialLng != null ? 17 : 6

  const [currentLat, setCurrentLat] = useState(startLat)
  const [currentLng, setCurrentLng] = useState(startLng)
  const [address, setAddress] = useState<string | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street')
  // Fullscreen mode. Small embedded map is fine for a quick verify, but if
  // the user needs to reposition precisely — especially on a phone — they
  // need a full-viewport map to see landmarks and drag with one finger.
  const [fullscreen, setFullscreen] = useState(false)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFired = useRef<string>('')
  const lastEmittedRef = useRef<{ lat: number; lng: number } | null>(null)

  const handleMove = useCallback((lat: number, lng: number) => {
    setCurrentLat(lat)
    setCurrentLng(lng)
    lastEmittedRef.current = { lat, lng }
    onChange({ lat, lng })

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key === lastFired.current) return
    lastFired.current = key

    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      try {
        const res       = await mapsApi.reverse(lat, lng)
        const formatted = res.data.data.result?.formatted_address ?? null
        setAddress(formatted)
        onChange({ lat, lng, address: formatted })
      } catch {
        setAddress(null)
      } finally {
        setGeocoding(false)
      }
    }, 500)
  }, [onChange])

  useEffect(() => {
    if (initialLat != null && initialLng != null) {
      setCurrentLat(initialLat)
      setCurrentLng(initialLng)
    }
  }, [initialLat, initialLng])

  // Lock page scroll while fullscreen — otherwise touch drags on the map
  // bleed into scrolling the underlying page on iOS.
  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  function renderMap() {
    return (
      <MapContainer
        center={[currentLat, currentLng]}
        zoom={initialLat != null && initialLng != null ? 17 : startZoom}
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
          <RecenterOnPropChange lat={initialLat} lng={initialLng} lastEmittedRef={lastEmittedRef} />
        )}
        <CenterTracker onMove={handleMove} />
      </MapContainer>
    )
  }

  function renderPin() {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center"
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
    )
  }

  function renderBasemapToggle() {
    return (
      <div className="flex overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5">
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
    )
  }

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
        style={{ height: heightPx }}
      >
        {!fullscreen && renderMap()}
        {!fullscreen && renderPin()}

        {!fullscreen && (
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            {renderBasemapToggle()}
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-lg ring-1 ring-black/5 hover:bg-gray-50"
              aria-label="Expand map to fullscreen"
            >
              <Maximize2 size={12} /> Expand
            </button>
          </div>
        )}

        {!fullscreen && !address && !geocoding && (
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="absolute bottom-3 left-3 right-3 z-[1000] rounded-lg bg-black/70 px-3 py-2.5 text-xs text-white backdrop-blur-sm transition hover:bg-black/80 sm:right-16"
          >
            Tap to open full map and place the pin on your building
          </button>
        )}
      </div>

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

      {fullscreen && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="relative flex-1">
            {renderMap()}
            {renderPin()}

            <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-lg ring-1 ring-black/5 hover:bg-gray-50"
                aria-label="Close fullscreen map"
              >
                <X size={14} /> Close
              </button>
              {renderBasemapToggle()}
            </div>

            <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-[1000] rounded-full bg-black/75 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
              Drag the map — pin stays centred on your building
            </div>
          </div>

          <div className="border-t border-gray-200 bg-white p-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 text-sm">
              {geocoding ? (
                <>
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                  <span className="text-gray-500">Looking up address…</span>
                </>
              ) : address ? (
                <>
                  <MapIcon size={14} className="shrink-0 text-orange-600" />
                  <span className="truncate text-gray-800"><strong>Pin location:</strong> {address}</span>
                </>
              ) : (
                <>
                  <MapIcon size={14} className="shrink-0 text-gray-400" />
                  <span className="text-gray-500">Drop a pin to see the address</span>
                </>
              )}
              <span className="ml-auto shrink-0 font-mono text-[10px] text-gray-400 tabular-nums">
                {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-700 active:bg-orange-800 transition-colors"
            >
              <Check size={16} /> Confirm this location
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
