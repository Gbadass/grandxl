'use client'

// Zone editor map (S13-11). Renders every delivery zone as a colored polygon
// over Google tiles + Carto fallback. Handles two modes:
//   1. `drawMode` — leaflet-geoman polygon-draw is active; user clicks vertices,
//      double-clicks to finish; on completion `onDrawn(latLngs)` fires with the
//      outer ring in [lat, lng] order.
//   2. Existing-zone edit — when `editingId` matches a zone, that polygon's
//      vertices become draggable via geoman's edit tools; on vertex drag we
//      fire `onEdited(id, latLngs)` so the page sees live changes.
//
// The polygons themselves are managed imperatively (native L.Polygon) rather
// than declaratively via react-leaflet's <Polygon> because geoman needs a
// stable L.Polygon reference to enable/disable edit mode without React
// re-mounting the layer mid-drag.

import { useEffect, useRef } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import type { DeliveryZone } from '@grandxl/types'
import { GoogleTileLayer, hasGoogleMapsKey } from '../GoogleTileLayer'
import { TileLayer } from 'react-leaflet'

// Distinct-but-harmonious hues for zone overlays. Tailwind-500 tones sit close
// together in luminance so overlapping zones don't visually punch each other.
// Cycled by zone index so identical seeds get consistent colors across renders.
const ZONE_COLORS = [
  '#F97316', // orange-500
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#F59E0B', // amber-500
  '#06B6D4', // cyan-500
  '#6366F1', // indigo-500
  '#F43F5E', // rose-500
  '#14B8A6', // teal-500
] as const

function colorFor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length]!
}

// Convert GeoJSON polygon (outer ring only) to Leaflet LatLng array.
// GeoJSON stores [lng, lat]; Leaflet wants [lat, lng].
function polygonToLatLngs(zone: DeliveryZone): [number, number][] {
  const ring = zone.polygon.coordinates[0] ?? []
  // Drop the closing point — Leaflet auto-closes polygons.
  return ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as [number, number])
}

interface ZoneMapInnerProps {
  zones:       DeliveryZone[]
  editingId:   string | null
  drawMode:    boolean
  onZoneClick: (id: string) => void
  onDrawn:     (latLngs: [number, number][]) => void
  onEdited:    (id: string, latLngs: [number, number][]) => void
}

// The imperative Leaflet layer manager. Runs inside <MapContainer> so `useMap`
// hands us the L.Map instance; from there we own the layer lifecycle.
function ZoneLayers({
  zones, editingId, drawMode, onZoneClick, onDrawn, onEdited,
}: ZoneMapInnerProps) {
  const map = useMap()
  const layersRef = useRef<Map<string, L.Polygon>>(new Map())
  // Stash callbacks in refs so the mount-only effect below can call them
  // without needing to re-run when callback identity changes.
  const callbacksRef = useRef({ onZoneClick, onDrawn, onEdited })
  callbacksRef.current = { onZoneClick, onDrawn, onEdited }

  // Fit map to zones on first load. Uses layer bounds so it works whether
  // there's one zone or many.
  const didFitRef = useRef(false)
  useEffect(() => {
    if (didFitRef.current || zones.length === 0) return
    const all = L.featureGroup(zones.map((z) => L.polygon(polygonToLatLngs(z))))
    map.fitBounds(all.getBounds(), { padding: [40, 40], maxZoom: 14 })
    didFitRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones.length])

  // Sync polygons with `zones` prop. Adds new, removes deleted, updates
  // coordinates on existing (in case the parent pushed a server-truth update).
  useEffect(() => {
    const seen = new Set<string>()
    zones.forEach((zone, idx) => {
      seen.add(zone._id)
      const color = colorFor(idx)
      const latLngs = polygonToLatLngs(zone)
      const existing = layersRef.current.get(zone._id)

      if (existing) {
        existing.setLatLngs(latLngs)
        existing.setStyle({ color, fillColor: color })
      } else {
        const polygon = L.polygon(latLngs, {
          color,
          weight:    2,
          opacity:   0.9,
          fillColor: color,
          fillOpacity: 0.18,
        })
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          callbacksRef.current.onZoneClick(zone._id)
        })
        polygon.on('pm:edit', (e) => {
          const geo = (e.layer as L.Polygon).toGeoJSON()
          const feat = geo as GeoJSON.Feature<GeoJSON.Polygon>
          const ring = feat.geometry.coordinates[0]!
          const flipped = ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as [number, number])
          callbacksRef.current.onEdited(zone._id, flipped)
        })
        polygon.addTo(map)
        layersRef.current.set(zone._id, polygon)
      }
    })
    // Remove polygons whose zone was deleted.
    layersRef.current.forEach((layer, id) => {
      if (!seen.has(id)) {
        map.removeLayer(layer)
        layersRef.current.delete(id)
      }
    })
  }, [zones, map])

  // Highlight the currently-selected zone; enable geoman edit mode on it.
  useEffect(() => {
    layersRef.current.forEach((layer, id) => {
      const selected = id === editingId
      layer.setStyle({
        weight:      selected ? 4 : 2,
        fillOpacity: selected ? 0.3 : 0.18,
        dashArray:   selected ? undefined : undefined,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pm = (layer as any).pm
      if (!pm) return
      if (selected && !drawMode) {
        pm.enable({ allowSelfIntersection: false, preventMarkerRemoval: false })
      } else {
        pm.disable()
      }
    })
  }, [editingId, drawMode])

  // Draw-mode toggle.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (map as any).pm
    if (!pm) return
    if (drawMode) {
      pm.enableDraw('Polygon', {
        snappable:      true,
        snapDistance:   20,
        finishOn:       'dblclick',
        allowSelfIntersection: false,
      })
    } else {
      pm.disableDraw('Polygon')
    }
  }, [drawMode, map])

  // Capture drawn polygon. We remove geoman's raw layer immediately — the
  // parent decides whether to persist it (and re-render as a normal zone
  // polygon) or discard it (cancel from the details card).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      const layer = e.layer as L.Polygon
      const geo = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
      const ring = geo.geometry.coordinates[0]!
      const flipped = ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as [number, number])
      map.removeLayer(layer)
      callbacksRef.current.onDrawn(flipped)
    }
    map.on('pm:create', handler)
    return () => { map.off('pm:create', handler) }
  }, [map])

  return null
}

interface Props extends ZoneMapInnerProps {
  heightPx?: number
}

export function ZoneMap({ heightPx = 640, ...rest }: Props) {
  // Nigeria centroid as fallback initial view; ZoneLayers refits once data loads.
  return (
    <MapContainer
      center={[9.082, 8.6753]}
      zoom={6}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: heightPx, borderRadius: 16, overflow: 'hidden' }}
    >
      {hasGoogleMapsKey ? (
        <GoogleTileLayer type="roadmap" />
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={20}
        />
      )}
      <ZoneLayers {...rest} />
    </MapContainer>
  )
}
