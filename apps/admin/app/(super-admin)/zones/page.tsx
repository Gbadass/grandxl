'use client'

// S13-11: Delivery-zone map polygon editor. Draws polygons on Google-tiled
// Leaflet, syncs them with the pre-existing `/admin/delivery-zones` REST API.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { adminDeliveryZonesApi } from '@grandxl/api-client'
import type { DeliveryZone } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

// SSR-off the map — Leaflet + geoman touch `window` at import time.
const ZoneMap = dynamic(
  () => import('../../../src/components/zones/ZoneMap').then((m) => m.ZoneMap),
  { ssr: false, loading: () => (
    <div className="flex h-[640px] w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
      Loading map…
    </div>
  ) },
)

// Palette must mirror ZoneMap.tsx — used by the sidebar swatches so a zone's
// list swatch matches its polygon on the map. Consider promoting to a shared
// export if a third consumer appears.
const ZONE_COLORS = [
  '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#F59E0B', '#06B6D4', '#6366F1', '#F43F5E', '#14B8A6',
] as const

function colorFor(index: number): string {
  return ZONE_COLORS[index % ZONE_COLORS.length]!
}

// Local editing state. `_id` null means "new, unsaved zone (just drawn)".
interface EditingForm {
  _id:                   string | null
  name:                  string
  city:                  string
  deliveryFeeMultiplier: number
  isActive:              boolean
  // Live polygon coords in [lat, lng] pairs (Leaflet order). Server converts
  // to [lng, lat] on save.
  latLngs:               [number, number][]
}

export default function ZonesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [drawMode, setDrawMode] = useState(false)
  const [editing, setEditing]   = useState<EditingForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DeliveryZone | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['admin-delivery-zones'],
    queryFn: async () => {
      const res = await adminDeliveryZonesApi.list()
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing,
  })

  const activeCount = useMemo(() => zones.filter((z) => z.isActive).length, [zones])
  const cityCount   = useMemo(
    () => new Set(zones.filter((z) => z.city).map((z) => z.city.toLowerCase())).size,
    [zones],
  )

  // Server → editing form sync. If server refetches and updates the zone
  // we're currently editing, pull in fields the user hasn't touched (name,
  // city, multiplier, isActive) but preserve any in-progress latLng drags.
  useEffect(() => {
    if (!editing?._id) return
    const fresh = zones.find((z) => z._id === editing._id)
    if (!fresh) {
      // Zone was deleted from another session; close the editor.
      setEditing(null)
    }
  }, [zones, editing?._id])

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (form: EditingForm) => {
      // Server needs [lng, lat] with a closing point equal to the first.
      const first = form.latLngs[0]!
      const closed: [number, number][] = [
        ...form.latLngs.map(([lat, lng]) => [lng, lat] as [number, number]),
        [first[1], first[0]],
      ]
      const res = await adminDeliveryZonesApi.create({
        name:                  form.name.trim(),
        city:                  form.city.trim() || undefined,
        coordinates:           closed,
        deliveryFeeMultiplier: form.deliveryFeeMultiplier,
        isActive:              form.isActive,
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Zone created')
      setEditing(null)
      setDrawMode(false)
      void qc.invalidateQueries({ queryKey: ['admin-delivery-zones'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not create zone')),
  })

  const updateMutation = useMutation({
    mutationFn: async (form: EditingForm & { _id: string }) => {
      const first = form.latLngs[0]!
      const closed: [number, number][] = [
        ...form.latLngs.map(([lat, lng]) => [lng, lat] as [number, number]),
        [first[1], first[0]],
      ]
      const res = await adminDeliveryZonesApi.update(form._id, {
        name:                  form.name.trim(),
        city:                  form.city.trim() || undefined,
        coordinates:           closed,
        deliveryFeeMultiplier: form.deliveryFeeMultiplier,
        isActive:              form.isActive,
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Zone updated')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin-delivery-zones'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not update zone')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeliveryZonesApi.delete(id),
    onSuccess: () => {
      toast.success('Zone deleted')
      setConfirmDelete(null)
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin-delivery-zones'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not delete zone')),
  })

  // Fast-toggle active from the sidebar row (bypasses the editor).
  const toggleActive = useMutation({
    mutationFn: (zone: DeliveryZone) =>
      adminDeliveryZonesApi.update(zone._id, { isActive: !zone.isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-delivery-zones'] }),
    onError: (err) => toast.error(parseApiError(err, 'Could not toggle zone')),
  })

  function handleZoneClick(id: string) {
    if (drawMode) return
    const zone = zones.find((z) => z._id === id)
    if (!zone) return
    setEditing({
      _id:                   zone._id,
      name:                  zone.name,
      city:                  zone.city,
      deliveryFeeMultiplier: zone.deliveryFeeMultiplier,
      isActive:              zone.isActive,
      latLngs:               zone.polygon.coordinates[0]!.slice(0, -1).map(([lng, lat]) => [lat, lng] as [number, number]),
    })
  }

  function handleDrawn(latLngs: [number, number][]) {
    setDrawMode(false)
    setEditing({
      _id:                   null,
      name:                  '',
      city:                  '',
      deliveryFeeMultiplier: 1.0,
      isActive:              true,
      latLngs,
    })
  }

  function handleEdited(id: string, latLngs: [number, number][]) {
    setEditing((prev) => (prev && prev._id === id ? { ...prev, latLngs } : prev))
  }

  function cancelEdit() {
    setEditing(null)
    setDrawMode(false)
  }

  function saveEdit() {
    if (!editing) return
    if (editing.name.trim().length < 1) {
      toast.error('Zone name is required')
      return
    }
    if (editing.latLngs.length < 3) {
      toast.error('Polygon needs at least 3 vertices')
      return
    }
    if (editing._id) {
      updateMutation.mutate({ ...editing, _id: editing._id })
    } else {
      createMutation.mutate(editing)
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending
  const canSave = !!editing && editing.name.trim().length > 0 && editing.latLngs.length >= 3

  if (isInitializing || !isAuthenticated) return null

  return (
    <div>
      <PageHeader
        title="Delivery Zones"
        subtitle="Polygons that define where the platform delivers. Click the map to select a zone; drag vertices to reshape."
      />

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard title="Total zones"        value={String(zones.length)}         sub="drawn on the map" />
        <StatsCard title="Active"             value={String(activeCount)}          sub={activeCount === zones.length ? 'all zones live' : `${zones.length - activeCount} paused`} />
        <StatsCard title="Cities covered"     value={String(cityCount)}            sub={cityCount === 1 ? 'city' : 'cities'} />
      </div>

      {/* Map + sidebar layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Map column with floating controls */}
        <div className="relative">
          <ZoneMap
            zones={zones}
            editingId={editing?._id ?? null}
            drawMode={drawMode}
            onZoneClick={handleZoneClick}
            onDrawn={handleDrawn}
            onEdited={handleEdited}
            heightPx={640}
          />

          {/* Draw-mode toggle FAB */}
          {!editing && (
            <motion.button
              type="button"
              onClick={() => setDrawMode((d) => !d)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1 }}
              className={`absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg ring-1 transition-colors ${
                drawMode
                  ? 'bg-white text-gray-800 ring-gray-200 hover:bg-gray-50'
                  : 'bg-primary text-white ring-primary/50 hover:bg-primary/90'
              }`}
            >
              {drawMode ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel drawing
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New zone
                </>
              )}
            </motion.button>
          )}

          {/* Draw-mode instructional banner */}
          <AnimatePresence>
            {drawMode && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm"
              >
                Click to add vertices · double-click to finish
              </motion.div>
            )}
          </AnimatePresence>

          {/* Details floating card — appears when editing */}
          <AnimatePresence>
            {editing && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                className="absolute bottom-4 right-4 z-[1000] w-[320px] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-gray-950/5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {editing._id ? 'Edit zone' : 'New zone'}
                  </h3>
                  <button
                    onClick={cancelEdit}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Close"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Zone name</label>
                    <input
                      type="text"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Lagos Island"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">City (optional)</label>
                    <input
                      type="text"
                      value={editing.city}
                      onChange={(e) => setEditing({ ...editing, city: e.target.value })}
                      placeholder="e.g. Lagos"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Delivery fee multiplier</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, deliveryFeeMultiplier: Math.max(0, +(editing.deliveryFeeMultiplier - 0.1).toFixed(2)) })}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        aria-label="Decrease"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                        </svg>
                      </button>
                      <div className="flex-1 rounded-lg bg-gray-50 py-2 text-center font-mono text-sm font-semibold text-gray-800">
                        {editing.deliveryFeeMultiplier.toFixed(2)}×
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing({ ...editing, deliveryFeeMultiplier: +(editing.deliveryFeeMultiplier + 0.1).toFixed(2) })}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        aria-label="Increase"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500">1.0 = base fee · 1.5 = +50% · 0.8 = discount</p>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Active</span>
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        editing.isActive ? 'bg-primary' : 'bg-gray-300'
                      }`}
                      aria-pressed={editing.isActive}
                    >
                      <motion.span
                        animate={{ x: editing.isActive ? 18 : 2 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                        className="inline-block h-4 w-4 rounded-full bg-white shadow"
                      />
                    </button>
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {editing._id && (
                    <button
                      type="button"
                      onClick={() => {
                        const zone = zones.find((z) => z._id === editing._id)
                        if (zone) setConfirmDelete(zone)
                      }}
                      className="flex h-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-100"
                      aria-label="Delete zone"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="button"
                    onClick={saveEdit}
                    disabled={!canSave || saving}
                    whileTap={{ scale: canSave ? 0.97 : 1 }}
                    transition={{ duration: 0.08 }}
                    className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <aside className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-950/[0.03]">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Zones ({zones.length})
            </h3>
          </div>
          <div className="max-h-[588px] overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading zones…</div>
            ) : zones.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-700">No zones yet</p>
                <p className="mt-1 text-xs text-gray-500">Click "New zone" on the map to draw your first polygon.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {zones.map((zone, idx) => {
                  const selected = editing?._id === zone._id
                  return (
                    <motion.li
                      key={zone._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.15 }}
                    >
                      <div
                        onClick={() => handleZoneClick(zone._id)}
                        className={`group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                          selected ? 'bg-orange-50/70' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(idx) }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{zone.name}</p>
                          <p className="truncate text-[11px] text-gray-500">
                            {zone.city || 'No city'} · {zone.deliveryFeeMultiplier.toFixed(2)}× fee
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleActive.mutate(zone) }}
                          disabled={toggleActive.isPending}
                          className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
                            zone.isActive ? 'bg-emerald-500' : 'bg-gray-300'
                          }`}
                          aria-label={zone.isActive ? 'Deactivate zone' : 'Activate zone'}
                          aria-pressed={zone.isActive}
                        >
                          <motion.span
                            animate={{ x: zone.isActive ? 14 : 2 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                            className="inline-block h-3 w-3 rounded-full bg-white shadow"
                          />
                        </button>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete zone?"
        description={confirmDelete ? `${confirmDelete.name} will be permanently removed. Customer addresses in this polygon will fall back to the default delivery fee.` : ''}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
