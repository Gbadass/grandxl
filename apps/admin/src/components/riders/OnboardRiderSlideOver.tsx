'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { adminRidersApi, adminUsersApi } from '@grandxl/api-client'
import type { PaginatedResponse, Rider, User } from '@grandxl/types'

type VehicleType = 'motorcycle' | 'bicycle' | 'car'

const VEHICLE_OPTIONS: { value: VehicleType; label: string; desc: string }[] = [
  { value: 'motorcycle', label: 'Motorcycle', desc: 'Fast city deliveries' },
  { value: 'bicycle',    label: 'Bicycle',    desc: 'Eco short routes' },
  { value: 'car',        label: 'Car',        desc: 'All-weather rides' },
]

const defaultForm = {
  riderPhone:     '',
  riderFirstName: '',
  riderLastName:  '',
  riderEmail:     '',
  riderPassword:  '',
  riderConfirm:   '',
  vehicleType:    'motorcycle' as VehicleType,
  vehiclePlate:   '',
}

function toE164(phone: string): string {
  const t = phone.trim()
  return t.startsWith('0') ? `+234${t.slice(1)}` : t
}
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(toE164(phone))
}

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error' | 'terminated'

export function OnboardRiderSlideOver({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm]           = useState(defaultForm)
  const [showPw, setShowPw]       = useState(false)
  const [createNew, setCreateNew] = useState(false)
  const [confirm, setConfirm]     = useState(false)   // confirmation step
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [foundUser, setFoundUser]       = useState<User | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const set = (k: keyof typeof defaultForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  // ── Phone lookup ─────────────────────────────────────────────────
  const doLookup = useCallback((phone: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLookupStatus('idle')
    setFoundUser(null)

    const e164 = toE164(phone)
    if (!isValidE164(phone)) return

    setLookupStatus('loading')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await adminUsersApi.list({ search: e164, limit: 10 })
        const users = (res.data?.data?.data ?? []) as User[]
        const match = users.find((u) => u.phone === e164) ?? null
        if (match) {
          setFoundUser(match)
          // Check the riders cache for a terminated profile matching this user
          const ridersCache = qc.getQueryData<{ data: { data: PaginatedResponse<Rider> } }>(['admin', 'riders'])
          const cachedRiders = (ridersCache?.data?.data?.data ?? []) as Rider[]
          const riderProfile = cachedRiders.find((r) => {
            const rUserId = typeof r.userId === 'object' ? (r.userId as { _id: string })._id : r.userId
            return rUserId === match._id
          })
          if (riderProfile?.terminatedAt) {
            setLookupStatus('terminated')
            setCreateNew(false)
          } else {
            setLookupStatus('found')
            setCreateNew(false)
          }
        } else {
          setLookupStatus('not_found')
          setCreateNew(true)
        }
      } catch {
        setLookupStatus('error')
        setCreateNew(true)
      }
    }, 600)
  }, [])

  useEffect(() => { doLookup(form.riderPhone) }, [form.riderPhone, doLookup])

  // ── Reset on close ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setForm(defaultForm)
      setLookupStatus('idle')
      setFoundUser(null)
      setShowPw(false)
      setCreateNew(false)
      setConfirm(false)
    }
  }, [open])

  // ── Validation ───────────────────────────────────────────────────
  const phoneValid = isValidE164(form.riderPhone)

  const newFieldsComplete = !createNew || (
    form.riderFirstName.trim().length > 0 &&
    form.riderLastName.trim().length > 0 &&
    form.riderPassword.length >= 8 &&
    form.riderPassword === form.riderConfirm
  )

  const mutation = useMutation({
    mutationFn: () => {
      if (!phoneValid) throw new Error('Enter a valid phone number')
      if (createNew) {
        if (!form.riderFirstName.trim() || !form.riderLastName.trim())
          throw new Error('First name and last name are required')
        if (form.riderPassword.length < 8)
          throw new Error('Password must be at least 8 characters')
        if (form.riderPassword !== form.riderConfirm)
          throw new Error('Passwords do not match')
      }
      return adminRidersApi.onboard({
        riderPhone:     toE164(form.riderPhone),
        riderFirstName: createNew ? form.riderFirstName.trim() : undefined,
        riderLastName:  createNew ? form.riderLastName.trim() : undefined,
        riderEmail:     createNew && form.riderEmail.trim() ? form.riderEmail.trim() : undefined,
        riderPassword:  createNew ? form.riderPassword : undefined,
        vehicleType:    form.vehicleType,
        vehiclePlate:   form.vehiclePlate.trim().toUpperCase() || undefined,
      })
    },
    onSuccess: (res) => {
      const rider = res.data?.data as Rider & { _id: string }
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            Rider onboarded and verified
            <button
              onClick={() => { toast.dismiss(t.id); router.push(`/riders/${rider._id}`) }}
              className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-orange-600 ring-1 ring-orange-200 hover:bg-orange-50"
            >
              View
            </button>
          </span>
        ),
        { duration: 6000 },
      )
      void qc.invalidateQueries({ queryKey: ['admin', 'riders'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to onboard rider'),
  })

  const canSubmit =
    phoneValid &&
    !mutation.isPending &&
    lookupStatus !== 'loading' &&
    lookupStatus !== 'terminated' &&
    newFieldsComplete

  if (!open) return null

  // ── Confirmation dialog ──────────────────────────────────────────
  if (confirm) {
    const name = foundUser
      ? `${foundUser.firstName} ${foundUser.lastName}`
      : `${form.riderFirstName} ${form.riderLastName}`
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => setConfirm(false)} />
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h3 className="text-base font-semibold text-gray-900">Confirm Rider Onboarding</h3>
          <p className="mt-2 text-sm text-gray-500">
            {foundUser
              ? `${name} has an existing GrandXL account. They will be given the RIDER role and added as a pre-verified rider.`
              : `A new GrandXL account will be created for ${name} and they will be immediately verified as a rider.`}
          </p>
          <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Phone</span>
              <span className="font-mono font-medium text-gray-800">{toE164(form.riderPhone)}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Vehicle</span>
              <span className="font-medium capitalize text-gray-800">
                {form.vehicleType}{form.vehiclePlate ? ` · ${form.vehiclePlate.toUpperCase()}` : ''}
              </span>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setConfirm(false)}
              className="flex-1 cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => { setConfirm(false); mutation.mutate() }}
              disabled={mutation.isPending}
              className="flex-1 cursor-pointer rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Onboarding…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main slide-over ──────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Onboard Rider</h2>
            <p className="text-sm text-gray-500">Create a pre-verified rider account</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">

          {/* ── RIDER ACCOUNT ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Rider Account</h3>
            <div className="space-y-3">

              {/* Phone */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone number *</label>
                <div className="relative">
                  <input
                    value={form.riderPhone}
                    onChange={(e) => set('riderPhone', e.target.value)}
                    placeholder="+2348012345678 or 08012…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-9 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    {lookupStatus === 'loading' && (
                      <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    {lookupStatus === 'found' && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-green-500">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                    )}
                    {lookupStatus === 'not_found' && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-orange-400">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Lookup feedback */}
                {lookupStatus === 'terminated' && foundUser && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-red-800">{foundUser.firstName} {foundUser.lastName} — Account Terminated</p>
                    <p className="mt-0.5 text-[11px] text-red-600">This rider has been permanently terminated. Open their profile and use the Reinstate action to re-activate them.</p>
                  </div>
                )}
                {lookupStatus === 'found' && foundUser && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                      {foundUser.firstName[0]}{foundUser.lastName[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-green-800">{foundUser.firstName} {foundUser.lastName}</p>
                      <p className="text-[11px] text-green-600">Existing account found — RIDER role will be added</p>
                    </div>
                  </div>
                )}
                {lookupStatus === 'not_found' && (
                  <p className="mt-1 text-xs text-orange-600">No GrandXL account found — fill in details below to create one</p>
                )}
                {lookupStatus === 'error' && (
                  <p className="mt-1 text-xs text-amber-600">Could not verify account status — fill in details if this is a new rider</p>
                )}
              </div>

              {/* New account toggle */}
              <button
                type="button"
                onClick={() => setCreateNew((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-dashed border-gray-300 px-4 py-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/30"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">Rider doesn&apos;t have a GrandXL account</p>
                  <p className="text-xs text-gray-400">Toggle to create their account now</p>
                </div>
                <div className={`relative ml-4 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${createNew ? 'bg-orange-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${createNew ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {/* New rider fields */}
              {createNew && (
                <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/30 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">First name *</label>
                      <input
                        value={form.riderFirstName}
                        onChange={(e) => set('riderFirstName', e.target.value)}
                        placeholder="Chukwuemeka"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Last name *</label>
                      <input
                        value={form.riderLastName}
                        onChange={(e) => set('riderLastName', e.target.value)}
                        placeholder="Okafor"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email <span className="font-normal text-gray-400">(optional — sends welcome email)</span>
                    </label>
                    <input
                      type="email"
                      value={form.riderEmail}
                      onChange={(e) => set('riderEmail', e.target.value)}
                      placeholder="rider@email.com"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Password *</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={form.riderPassword}
                        onChange={(e) => set('riderPassword', e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-gray-600"
                      >
                        {showPw ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clipRule="evenodd" />
                            <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.892-2.66-9.336-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password *</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.riderConfirm}
                      onChange={(e) => set('riderConfirm', e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 ${
                        form.riderConfirm && form.riderConfirm !== form.riderPassword
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-gray-200 focus:border-orange-400'
                      }`}
                    />
                    {form.riderConfirm && form.riderConfirm !== form.riderPassword && (
                      <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── VEHICLE ── */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {VEHICLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('vehicleType', opt.value)}
                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-colors ${
                      form.vehicleType === opt.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[10px] text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Vehicle plate <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  value={form.vehiclePlate}
                  onChange={(e) => set('vehiclePlate', e.target.value.toUpperCase())}
                  placeholder="e.g. LND-123XY"
                  maxLength={20}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm uppercase tracking-wider focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
          </section>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs leading-relaxed text-green-700">
              <span className="font-semibold">Pre-verified:</span> Riders onboarded by admin skip the KYC queue and are immediately activated to accept deliveries.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setConfirm(true)}
            disabled={!canSubmit}
            className="flex-1 cursor-pointer rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lookupStatus === 'loading' ? 'Checking…' : 'Onboard Rider'}
          </button>
        </div>
      </div>
    </div>
  )
}
