'use client'

// S13-12: Surge pricing rules. Time-based multipliers on the delivery fee,
// evaluated in Africa/Lagos local time. Backend already exposes CRUD and a
// live-multiplier preview endpoint — this page surfaces both to super-admin.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { adminSurgePricingApi } from '@grandxl/api-client'
import type { SurgeRule } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import { StatsCard } from '../../../src/components/ui/StatsCard'
import { DataTable, type Column } from '../../../src/components/ui/DataTable'
import { ConfirmDialog } from '../../../src/components/ui/ConfirmDialog'
import '../../../src/lib/axios'

// ── Utils ────────────────────────────────────────────────────────────────────
const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const DAY_LABELS_LONG  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

// Africa/Lagos "now" — matches the server's evaluation timezone so the
// "active now" pill on each rule is consistent with what the API applies.
function lagosNowMinutes(): { day: number; minute: number } {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
  return { day: now.getDay(), minute: now.getHours() * 60 + now.getMinutes() }
}

function isActiveNow(rule: SurgeRule): boolean {
  if (!rule.isActive) return false
  const { day, minute } = lagosNowMinutes()
  return rule.daysOfWeek.includes(day) && minute >= rule.startMinutes && minute <= rule.endMinutes
}

// ── Editing form shape ──────────────────────────────────────────────────────
interface EditingForm {
  _id:          string | null
  name:         string
  multiplier:   number
  daysOfWeek:   number[]
  startMinutes: number
  endMinutes:   number
  isActive:     boolean
}

const BLANK_FORM: EditingForm = {
  _id:          null,
  name:         '',
  multiplier:   1.5,
  daysOfWeek:   [5, 6],  // Fri + Sat default — most common surge window
  startMinutes: 18 * 60, // 18:00
  endMinutes:   22 * 60, // 22:00
  isActive:     true,
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SurgePricingPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [editing, setEditing] = useState<EditingForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SurgeRule | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['admin-surge-rules'],
    queryFn: async () => {
      const res = await adminSurgePricingApi.list()
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing,
  })

  // Live preview — server tells us what multiplier is in effect right this
  // second. Refetches every 60s so admin sees the transition when a window
  // starts or ends. Client-side isActiveNow is a fast estimate; this is truth.
  const { data: liveMultiplier } = useQuery({
    queryKey: ['admin-surge-current'],
    queryFn: async () => {
      const res = await adminSurgePricingApi.currentMultiplier()
      return res.data.data.multiplier
    },
    enabled: isAuthenticated && !isInitializing,
    refetchInterval: 60_000,
  })

  const activeCount    = useMemo(() => rules.filter((r) => r.isActive).length, [rules])
  const activeNowCount = useMemo(() => rules.filter(isActiveNow).length, [rules])

  const createMutation = useMutation({
    mutationFn: async (form: EditingForm) => {
      const res = await adminSurgePricingApi.create({
        name:         form.name.trim(),
        multiplier:   form.multiplier,
        daysOfWeek:   form.daysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes:   form.endMinutes,
        isActive:     form.isActive,
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Surge rule created')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin-surge-rules'] })
      void qc.invalidateQueries({ queryKey: ['admin-surge-current'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not create rule')),
  })

  const updateMutation = useMutation({
    mutationFn: async (form: EditingForm & { _id: string }) => {
      const res = await adminSurgePricingApi.update(form._id, {
        name:         form.name.trim(),
        multiplier:   form.multiplier,
        daysOfWeek:   form.daysOfWeek,
        startMinutes: form.startMinutes,
        endMinutes:   form.endMinutes,
        isActive:     form.isActive,
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Rule updated')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: ['admin-surge-rules'] })
      void qc.invalidateQueries({ queryKey: ['admin-surge-current'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not update rule')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminSurgePricingApi.delete(id),
    onSuccess: () => {
      toast.success('Rule deleted')
      setConfirmDelete(null)
      void qc.invalidateQueries({ queryKey: ['admin-surge-rules'] })
      void qc.invalidateQueries({ queryKey: ['admin-surge-current'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not delete rule')),
  })

  const toggleActive = useMutation({
    mutationFn: (rule: SurgeRule) =>
      adminSurgePricingApi.update(rule._id, { isActive: !rule.isActive }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-surge-rules'] })
      void qc.invalidateQueries({ queryKey: ['admin-surge-current'] })
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not toggle rule')),
  })

  function openEditor(rule: SurgeRule) {
    setEditing({
      _id:          rule._id,
      name:         rule.name,
      multiplier:   rule.multiplier,
      daysOfWeek:   [...rule.daysOfWeek],
      startMinutes: rule.startMinutes,
      endMinutes:   rule.endMinutes,
      isActive:     rule.isActive,
    })
  }

  function saveForm() {
    if (!editing) return
    if (editing.name.trim().length < 1) { toast.error('Rule name is required'); return }
    if (editing.daysOfWeek.length === 0) { toast.error('Pick at least one day'); return }
    if (editing.endMinutes <= editing.startMinutes) { toast.error('End time must be after start time'); return }
    if (editing._id) updateMutation.mutate({ ...editing, _id: editing._id })
    else createMutation.mutate(editing)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<SurgeRule>[] = [
    {
      key: 'name',
      header: 'Rule',
      render: (r) => {
        const activeNow = isActiveNow(r)
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold text-gray-900">{r.name}</p>
              {activeNow && (
                <motion.span
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                  </span>
                  Live
                </motion.span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      key: 'multiplier',
      header: 'Multiplier',
      render: (r) => (
        <span className="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 font-mono text-sm font-bold text-orange-700 ring-1 ring-orange-200">
          {r.multiplier.toFixed(1)}×
        </span>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      render: (r) => (
        <div className="flex gap-1">
          {DAY_LABELS_SHORT.map((label, idx) => {
            const on = r.daysOfWeek.includes(idx)
            return (
              <span
                key={idx}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold ${
                  on ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
                }`}
                title={DAY_LABELS_LONG[idx]}
              >
                {label}
              </span>
            )
          })}
        </div>
      ),
    },
    {
      key: 'window',
      header: 'Time window',
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          {minutesToHHMM(r.startMinutes)} – {minutesToHHMM(r.endMinutes)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleActive.mutate(r) }}
          disabled={toggleActive.isPending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            r.isActive ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
          aria-pressed={r.isActive}
          aria-label={r.isActive ? 'Deactivate rule' : 'Activate rule'}
        >
          <motion.span
            animate={{ x: r.isActive ? 18 : 2 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="inline-block h-4 w-4 rounded-full bg-white shadow"
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 'w-24',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openEditor(r) }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(r) }}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  if (isInitializing || !isAuthenticated) return null

  const currentMult = liveMultiplier ?? 1.0
  const surging = currentMult > 1.0

  return (
    <div>
      <PageHeader
        title="Surge Pricing"
        subtitle="Time-based multipliers on the delivery fee. Evaluated in Africa/Lagos local time; the highest matching rule wins."
        action={
          <motion.button
            type="button"
            onClick={() => setEditing({ ...BLANK_FORM })}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.1 }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New rule
          </motion.button>
        }
      />

      {/* Live "right now" banner */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`mb-4 flex items-center justify-between rounded-2xl border p-4 ${
          surging
            ? 'border-red-200 bg-red-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            surging ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-widest ${surging ? 'text-red-700' : 'text-emerald-700'}`}>
              Live multiplier
            </p>
            <p className="mt-0.5 text-xl font-bold text-gray-900">
              {currentMult.toFixed(1)}× {surging ? 'surge active' : '(base fee)'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">Updates every minute · Africa/Lagos</p>
      </motion.div>

      {/* Stats strip */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatsCard title="Total rules"   value={String(rules.length)}    sub="configured" />
        <StatsCard title="Enabled"       value={String(activeCount)}     sub={activeCount === rules.length ? 'all enabled' : `${rules.length - activeCount} paused`} />
        <StatsCard title="Active now"    value={String(activeNowCount)}  sub={activeNowCount ? 'firing this minute' : 'window closed'} />
      </div>

      <DataTable
        columns={columns}
        data={rules}
        loading={isLoading}
        emptyMessage="No surge rules yet — click 'New rule' to add one."
        onRowClick={openEditor}
      />

      {/* Editor modal */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => !saving && setEditing(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 22, stiffness: 260 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {editing._id ? 'Edit surge rule' : 'New surge rule'}
                </h3>
                <button
                  onClick={() => !saving && setEditing(null)}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Rule name</label>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g. Friday dinner rush"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Multiplier</label>
                    <span className="font-mono text-lg font-bold text-orange-600">{editing.multiplier.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={5.0}
                    step={0.1}
                    value={editing.multiplier}
                    onChange={(e) => setEditing({ ...editing, multiplier: parseFloat(e.target.value) })}
                    className="w-full accent-orange-500"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                    <span>1.0× (base)</span>
                    <span>5.0× (cap)</span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Days</label>
                  <div className="flex gap-1.5">
                    {DAY_LABELS_LONG.map((label, idx) => {
                      const on = editing.daysOfWeek.includes(idx)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const next = on
                              ? editing.daysOfWeek.filter((d) => d !== idx)
                              : [...editing.daysOfWeek, idx].sort()
                            setEditing({ ...editing, daysOfWeek: next })
                          }}
                          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                            on
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                          title={label}
                        >
                          {label.slice(0, 1)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Start time</label>
                    <input
                      type="time"
                      value={minutesToHHMM(editing.startMinutes)}
                      onChange={(e) => setEditing({ ...editing, startMinutes: hhmmToMinutes(e.target.value) })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">End time</label>
                    <input
                      type="time"
                      value={minutesToHHMM(editing.endMinutes)}
                      onChange={(e) => setEditing({ ...editing, endMinutes: hhmmToMinutes(e.target.value) })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                  <span className="text-sm font-medium text-gray-700">Active</span>
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

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !saving && setEditing(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={saveForm}
                  disabled={saving}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editing._id ? 'Save changes' : 'Create rule'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete surge rule?"
        description={confirmDelete ? `"${confirmDelete.name}" (${confirmDelete.multiplier.toFixed(1)}×) will be removed. Orders placed during its window will fall back to the base delivery fee.` : ''}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
