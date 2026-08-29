'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { adminRestaurantsApi, adminUsersApi, foodCategoriesApi } from '@grandxl/api-client'
import type { User } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { AddressAutocomplete } from '../AddressAutocomplete'

// S-URGENT-2: dynamic import — leaflet touches `window` at load.
const MapPicker = dynamic(
  () => import('../MapPicker').then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-2xl bg-gray-100" /> },
)

interface Props {
  open: boolean
  onClose: () => void
}

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
]

// Matches DEFAULT_CATEGORIES in FoodCategoriesService — same list as register page fallback
const FALLBACK_CUISINE_SUGGESTIONS = [
  'Rice','Chicken','Burgers','Swallow','Soups & Stews','Pizza','Shawarma',
  'Seafood','Desserts','Grills & Suya','Fast Food','Snacks','Breakfast',
  'Continental','Chinese','Drinks & Smoothies','Wraps & Sandwiches','Healthy',
]

const defaultForm = {
  ownerFirstName: '',
  ownerLastName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerPassword: '',
  ownerConfirmPassword: '',
  name: '',
  phone: '',
  email: '',
  description: '',
  cuisineInput: '',
  cuisine: [] as string[],
  street: '',
  city: '',
  state: '',
  lat: '',
  lng: '',
  minOrderAmount: '',
  estimatedDeliveryTime: '30',
  deliveryFeeFixed: '',
  deliveryRadius: '5',
}

// Sprint 13 (S13-6): four-step wizard sequence. Each step guards only the
// fields it renders so mistakes surface at the step they were made, not at
// final submit five sections away.
const WIZARD_STEPS = [
  { key: 1, label: 'Owner',    hint: 'Who runs the restaurant' },
  { key: 2, label: 'Restaurant', hint: 'Name, contact, cuisine' },
  { key: 3, label: 'Address',  hint: 'Where they operate' },
  { key: 4, label: 'Settings', hint: 'Delivery + pricing defaults' },
] as const
type StepKey = typeof WIZARD_STEPS[number]['key']

export function OnboardSlideOver({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cuisineOpen, setCuisineOpen] = useState(false)
  const [cuisineSuggestions, setCuisineSuggestions] = useState<string[]>(FALLBACK_CUISINE_SUGGESTIONS)
  // Sprint 13 (S13-6): current wizard step (1..4)
  const [step, setStep] = useState<StepKey>(1)

  // Owner phone lookup — determines whether password fields are shown
  const [ownerLookup, setOwnerLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'not_found'
    user: User | null
  }>({ status: 'idle', user: null })
  const [showPassword, setShowPassword] = useState(false)

  const firstInput = useRef<HTMLInputElement>(null)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setForm(defaultForm)
      setErrors({})
      setOwnerLookup({ status: 'idle', user: null })
      setShowPassword(false)
      setStep(1) // Sprint 13 (S13-6): reset wizard to step 1 on open
      setTimeout(() => firstInput.current?.focus(), 100)
    }
  }, [open])

  // Load real categories from API on mount
  useEffect(() => {
    foodCategoriesApi.getAll()
      .then((res) => {
        const data = res.data.data
        if (Array.isArray(data) && data.length > 0) {
          setCuisineSuggestions(data.map((c) => c.name))
        }
      })
      .catch(() => { /* fallback list already set */ })
  }, [])

  // Debounced owner phone lookup — found → hide password fields, not_found → show them
  const lookupOwner = useCallback((phone: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    if (!phone.match(/^\+[1-9]\d{7,14}$/)) {
      setOwnerLookup({ status: 'idle', user: null })
      return
    }
    setOwnerLookup({ status: 'loading', user: null })
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await adminUsersApi.list({ search: phone, limit: 1 })
        const users = res.data.data.data
        if (users.length > 0 && (users[0].phone === phone || users[0].email === phone)) {
          setOwnerLookup({ status: 'found', user: users[0] })
        } else {
          setOwnerLookup({ status: 'not_found', user: null })
        }
      } catch {
        setOwnerLookup({ status: 'idle', user: null })
      }
    }, 600)
  }, [])

  const mutation = useMutation({
    mutationFn: () =>
      adminRestaurantsApi.onboard({
        ownerPhone: form.ownerPhone.trim(),
        // Only send personal details when creating a new account (not_found)
        ...(ownerLookup.status === 'not_found' && {
          ownerFirstName: form.ownerFirstName.trim(),
          ownerLastName: form.ownerLastName.trim(),
          ownerEmail: form.ownerEmail.trim() || undefined,
          ownerPassword: form.ownerPassword,
        }),
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        description: form.description.trim() || undefined,
        cuisine: form.cuisine,
        address: {
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state,
          country: 'NG',
          lat: form.lat ? parseFloat(form.lat) : undefined,
          lng: form.lng ? parseFloat(form.lng) : undefined,
        },
        minOrderAmount: form.minOrderAmount ? Math.round(parseFloat(form.minOrderAmount) * 100) : undefined,
        estimatedDeliveryTime: form.estimatedDeliveryTime ? parseInt(form.estimatedDeliveryTime) : undefined,
        deliveryFeeFixed: form.deliveryFeeFixed ? Math.round(parseFloat(form.deliveryFeeFixed) * 100) : undefined,
        deliveryRadius: form.deliveryRadius ? parseFloat(form.deliveryRadius) : undefined,
      }),
    onSuccess: () => {
      toast.success('Restaurant onboarded and approved')
      void qc.invalidateQueries({ queryKey: ['admin', 'restaurants'] })
      onClose()
    },
    onError: (err: unknown) => toast.error(parseApiError(err, 'Onboard failed')),
  })

  // Sprint 13 (S13-6): per-step validators. Each returns the subset of errors
  // relevant to that step so Continue only advances when the current step is
  // clean; final Submit runs all four for defence in depth.
  function validateStep1(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.ownerFirstName.trim()) e.ownerFirstName = 'First name is required'
    if (!form.ownerLastName.trim())  e.ownerLastName  = 'Last name is required'
    if (form.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) e.ownerEmail = 'Invalid email address'
    if (!form.ownerPhone.match(/^\+[1-9]\d{7,14}$/)) e.ownerPhone = 'E.164 format required (+2348012345678)'
    if (ownerLookup.status === 'loading') e.ownerPhone = 'Checking account — please wait a moment'
    if (ownerLookup.status === 'not_found') {
      if (form.ownerPassword.length < 8) e.ownerPassword = 'Minimum 8 characters'
      else if (!/[A-Z]/.test(form.ownerPassword)) e.ownerPassword = 'Must include at least one uppercase letter'
      else if (!/[0-9]/.test(form.ownerPassword)) e.ownerPassword = 'Must include at least one number'
      if (form.ownerConfirmPassword !== form.ownerPassword) e.ownerConfirmPassword = 'Passwords do not match'
    }
    return e
  }
  function validateStep2(): Record<string, string> {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Name is required'
    if (!form.phone.match(/^\+[1-9]\d{7,14}$/)) e.phone = 'E.164 format required (+2348012345678)'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (form.cuisine.length === 0) e.cuisine = 'At least one cuisine type'
    return e
  }
  function validateStep3(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.street.trim()) e.street = 'Street is required'
    if (!form.city.trim())   e.city   = 'City is required'
    if (!form.state)         e.state  = 'State is required'
    return e
  }
  function validateStep4(): Record<string, string> {
    // All Step 4 fields have safe defaults on submit — no required validation.
    return {}
  }
  function validateAll(): boolean {
    const e = { ...validateStep1(), ...validateStep2(), ...validateStep3(), ...validateStep4() }
    setErrors(e)
    return Object.keys(e).length === 0
  }
  function validateCurrentStep(): boolean {
    const v = step === 1 ? validateStep1()
            : step === 2 ? validateStep2()
            : step === 3 ? validateStep3()
            :              validateStep4()
    setErrors(v)
    return Object.keys(v).length === 0
  }

  function addCuisine(tag: string) {
    const t = tag.trim()
    if (t && !form.cuisine.includes(t)) {
      setForm(f => ({ ...f, cuisine: [...f.cuisine, t], cuisineInput: '' }))
      setErrors(e => ({ ...e, cuisine: '' }))
    }
    setCuisineOpen(false)
  }

  function removeCuisine(tag: string) {
    setForm(f => ({ ...f, cuisine: f.cuisine.filter(c => c !== tag) }))
  }

  function set(key: keyof typeof defaultForm, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  if (!open) return null

  const filteredSuggestions = cuisineSuggestions.filter(
    s => s.toLowerCase().includes(form.cuisineInput.toLowerCase()) && !form.cuisine.includes(s)
  )

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Onboard Restaurant</h2>
              <p className="mt-0.5 text-sm text-gray-500">Step {step} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step - 1]?.hint}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sprint 13 (S13-6): step indicator — clickable dots let admin
              jump backward to fix an earlier step; forward clicks are a no-op
              until the current step validates (Continue is the only forward
              path so validation always runs). */}
          <div className="mt-4 flex items-center gap-1.5">
            {WIZARD_STEPS.map((s) => {
              const active = s.key === step
              const done   = s.key < step
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={s.key > step}
                  onClick={() => s.key < step && setStep(s.key)}
                  className={`flex-1 rounded-full py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    active ? 'bg-orange-600 text-white' :
                    done   ? 'bg-orange-100 text-orange-700 cursor-pointer hover:bg-orange-200' :
                             'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {s.key}. {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">

            {/* Sprint 13 (S13-6): STEP 1 — Owner */}
            {step === 1 && (
            <Section label="Owner Account" icon="person">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" error={errors.ownerFirstName} required>
                  <input
                    ref={firstInput}
                    type="text"
                    value={form.ownerFirstName}
                    onChange={e => set('ownerFirstName', e.target.value)}
                    placeholder="Amaka"
                    className={input(errors.ownerFirstName ?? '')}
                  />
                </Field>
                <Field label="Last Name" error={errors.ownerLastName} required>
                  <input
                    type="text"
                    value={form.ownerLastName}
                    onChange={e => set('ownerLastName', e.target.value)}
                    placeholder="Okonkwo"
                    className={input(errors.ownerLastName ?? '')}
                  />
                </Field>
              </div>

              <Field label="Email Address" error={errors.ownerEmail}>
                <input
                  type="email"
                  value={form.ownerEmail}
                  onChange={e => set('ownerEmail', e.target.value)}
                  placeholder="amaka@restaurant.com"
                  className={input(errors.ownerEmail ?? '')}
                />
                <p className="mt-1 text-xs text-gray-400">Optional — welcome email with login details sent here</p>
              </Field>

              <Field label="Phone Number" error={errors.ownerPhone} required>
                <div className="relative">
                  <input
                    type="tel"
                    value={form.ownerPhone}
                    onChange={e => {
                      set('ownerPhone', e.target.value)
                      lookupOwner(e.target.value)
                    }}
                    placeholder="+2348012345678"
                    className={input(errors.ownerPhone) + ' pr-9'}
                  />
                  {ownerLookup.status === 'loading' && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      <svg className="h-4 w-4 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">E.164 format · include country code e.g. +234 for Nigeria</p>

                {/* Existing account found — no password needed */}
                {ownerLookup.status === 'found' && ownerLookup.user && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-green-800">
                        Existing account — {ownerLookup.user.firstName} {ownerLookup.user.lastName}
                      </p>
                      <p className="text-xs text-green-600">Owner will log in with their existing password</p>
                    </div>
                  </div>
                )}
              </Field>

              {/* Password fields — only shown when phone has no account yet */}
              {ownerLookup.status === 'not_found' && (
                <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                  <p className="text-xs font-medium text-blue-700">
                    No account found for this number — set a password to create one
                  </p>
                  <Field label="Password" error={errors.ownerPassword} required>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.ownerPassword}
                        onChange={e => set('ownerPassword', e.target.value)}
                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                        className={input(errors.ownerPassword ?? '') + ' pr-9'}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute inset-y-0 right-3 flex cursor-pointer items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label="Confirm Password" error={errors.ownerConfirmPassword} required>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.ownerConfirmPassword}
                      onChange={e => set('ownerConfirmPassword', e.target.value)}
                      placeholder="Repeat the password"
                      className={input(errors.ownerConfirmPassword ?? '')}
                    />
                  </Field>
                </div>
              )}
            </Section>
            )}

            {/* Sprint 13 (S13-6): STEP 2 — Restaurant Details */}
            {step === 2 && (
            <Section label="Restaurant Details" icon="store">
              <Field label="Restaurant Name" error={errors.name} required>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Mama Amaka's Kitchen"
                  className={input(errors.name)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Restaurant Phone" error={errors.phone} required>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+2348012345678"
                    className={input(errors.phone)}
                  />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="info@restaurant.com"
                    className={input(errors.email)}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Short description of the restaurant…"
                  rows={2}
                  className={input('') + ' resize-none'}
                />
              </Field>

              {/* Cuisine Tags */}
              <Field label="Cuisine Types" error={errors.cuisine} required>
                <div className={`min-h-[42px] flex flex-wrap gap-1.5 rounded-lg border px-3 py-2 ${errors.cuisine ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                  {form.cuisine.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                      {tag}
                      <button type="button" onClick={() => removeCuisine(tag)} className="cursor-pointer text-orange-400 hover:text-orange-700">×</button>
                    </span>
                  ))}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={form.cuisineInput}
                      onChange={e => { set('cuisineInput', e.target.value); setCuisineOpen(true) }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCuisine(form.cuisineInput) } }}
                      onFocus={() => setCuisineOpen(true)}
                      onBlur={() => setTimeout(() => setCuisineOpen(false), 150)}
                      placeholder={form.cuisine.length === 0 ? 'Type or pick cuisine…' : ''}
                      className="w-full min-w-[100px] bg-transparent text-sm outline-none placeholder:text-gray-400"
                    />
                    {cuisineOpen && filteredSuggestions.length > 0 && (
                      <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {filteredSuggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={() => addCuisine(s)}
                            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {errors.cuisine && <p className="mt-1 text-xs text-red-500">{errors.cuisine}</p>}
                {/* Quick-pick chips — always show unselected options */}
                {(() => {
                  const unselected = cuisineSuggestions.filter(s => !form.cuisine.includes(s)).slice(0, 8)
                  return unselected.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {unselected.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addCuisine(s)}
                          className="cursor-pointer rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </Field>
            </Section>
            )}

            {/* Sprint 13 (S13-6): STEP 3 — Address */}
            {step === 3 && (
            <Section label="Address" icon="location">
              <Field label="Search Address">
                <AddressAutocomplete
                  onFill={({ street, city, state, lat, lng }) => {
                    setForm(f => ({
                      ...f,
                      street: street || f.street,
                      city: city || f.city,
                      state: state || f.state,
                      // S-URGENT-2: seed the map picker with Google's coords
                      // as a starting point — admin still confirms visually.
                      ...(lat != null && lng != null ? { lat: String(lat), lng: String(lng) } : {}),
                    }))
                    setErrors(e => ({ ...e, street: '', city: '', state: '' }))
                  }}
                />
              </Field>

              <Field label="Street Address" error={errors.street} required>
                <input
                  type="text"
                  value={form.street}
                  onChange={e => set('street', e.target.value)}
                  placeholder="15 Adeola Odeku Street"
                  className={input(errors.street)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" error={errors.city} required>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    placeholder="Lagos"
                    className={input(errors.city)}
                  />
                </Field>
                <Field label="State" error={errors.state} required>
                  <select
                    value={form.state}
                    onChange={e => set('state', e.target.value)}
                    className={input(errors.state) + ' cursor-pointer'}
                  >
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              {/* S-URGENT-2: interactive map picker — authoritative source of
                  coordinates. Autocomplete above seeds the pin; final lat/lng
                  come from wherever the admin drops it. Prevents the "Google
                  autocomplete returned a nearby unrelated business" bug. */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">
                  Pin the exact restaurant location
                </p>
                <p className="text-xs text-gray-500 -mt-1">
                  Drag the map so the pin sits on the restaurant&apos;s building. Switch to Satellite
                  for rooftop precision. Riders navigate to this pin — accuracy matters.
                </p>
                <MapPicker
                  initialLat={form.lat ? parseFloat(form.lat) : null}
                  initialLng={form.lng ? parseFloat(form.lng) : null}
                  onChange={({ lat, lng }) => {
                    setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))
                  }}
                  heightPx={280}
                />
              </div>
            </Section>
            )}

            {/* Sprint 13 (S13-6): STEP 4 — Business Settings */}
            {step === 4 && (
            <Section label="Business Settings" icon="settings">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min Order (₦)">
                  <input
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={e => set('minOrderAmount', e.target.value)}
                    placeholder="500"
                    className={input('')}
                  />
                </Field>
                <Field label="Delivery Fee (₦)">
                  <input
                    type="number"
                    min="0"
                    value={form.deliveryFeeFixed}
                    onChange={e => set('deliveryFeeFixed', e.target.value)}
                    placeholder="1000"
                    className={input('')}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Est. Delivery (min)">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={form.estimatedDeliveryTime}
                    onChange={e => set('estimatedDeliveryTime', e.target.value)}
                    placeholder="30"
                    className={input('')}
                  />
                </Field>
                <Field label="Delivery Radius (km)">
                  <input
                    type="number"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={form.deliveryRadius}
                    onChange={e => set('deliveryRadius', e.target.value)}
                    placeholder="5"
                    className={input('')}
                  />
                </Field>
              </div>
            </Section>
            )}

          </div>
        </div>

        {/* Sprint 13 (S13-6): Wizard footer — Back / Continue / Submit */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as StepKey)}
            className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < WIZARD_STEPS.length ? (
            <button
              type="button"
              onClick={() => { if (validateCurrentStep()) setStep((s) => (s + 1) as StepKey) }}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => { if (validateAll()) mutation.mutate(); else setStep(1) }}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-60"
            >
              {mutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Onboarding…
                </>
              ) : 'Onboard Restaurant'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  const icons: Record<string, React.ReactNode> = {
    person: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    store: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    ),
    location: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    settings: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-50 text-orange-600">
          {icons[icon]}
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</h3>
      </div>
      <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function input(error: string) {
  return `w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 transition-colors outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-orange-100 ${
    error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-200 bg-white focus:border-orange-400'
  }`
}
