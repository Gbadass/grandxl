'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { adminRestaurantsApi, adminUsersApi, foodCategoriesApi } from '@grandxl/api-client'
import type { User } from '@grandxl/types'

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
  ownerPhone: '',
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

export function OnboardSlideOver({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cuisineOpen, setCuisineOpen] = useState(false)
  const [cuisineSuggestions, setCuisineSuggestions] = useState<string[]>(FALLBACK_CUISINE_SUGGESTIONS)

  // Owner phone lookup state
  const [ownerLookup, setOwnerLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'not_found'
    user: User | null
  }>({ status: 'idle', user: null })

  const firstInput = useRef<HTMLInputElement>(null)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setForm(defaultForm)
      setErrors({})
      setOwnerLookup({ status: 'idle', user: null })
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

  // Debounced owner phone lookup
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
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : (msg ?? 'Onboard failed'))
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.ownerPhone.match(/^\+[1-9]\d{7,14}$/)) e.ownerPhone = 'E.164 format required (+2348012345678)'
    if (ownerLookup.status === 'not_found') e.ownerPhone = 'No GrandXL account found for this number'
    if (form.name.trim().length < 2) e.name = 'Name is required'
    if (!form.phone.match(/^\+[1-9]\d{7,14}$/)) e.phone = 'E.164 format required (+2348012345678)'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (form.cuisine.length === 0) e.cuisine = 'At least one cuisine type'
    if (!form.street.trim()) e.street = 'Street is required'
    if (!form.city.trim()) e.city = 'City is required'
    if (!form.state) e.state = 'State is required'
    setErrors(e)
    return Object.keys(e).length === 0
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
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Onboard Restaurant</h2>
            <p className="mt-0.5 text-sm text-gray-500">Create and approve a restaurant directly</p>
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

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">

            {/* Owner */}
            <Section label="Owner" icon="person">
              <Field label="Owner Phone Number" error={errors.ownerPhone} required>
                <input
                  ref={firstInput}
                  type="tel"
                  value={form.ownerPhone}
                  onChange={e => {
                    set('ownerPhone', e.target.value)
                    lookupOwner(e.target.value)
                  }}
                  placeholder="+2348012345678"
                  className={input(errors.ownerPhone)}
                />
                <p className="mt-1.5 text-xs text-gray-400">Must be an existing GrandXL user account</p>

                {/* Owner lookup feedback */}
                {ownerLookup.status === 'loading' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Looking up account…
                  </div>
                )}
                {ownerLookup.status === 'found' && ownerLookup.user && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-green-800">
                        {ownerLookup.user.firstName} {ownerLookup.user.lastName}
                      </p>
                      {ownerLookup.user.email && (
                        <p className="truncate text-xs text-green-600">{ownerLookup.user.email}</p>
                      )}
                    </div>
                  </div>
                )}
                {ownerLookup.status === 'not_found' && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-red-700">No GrandXL account found for this number</p>
                  </div>
                )}
              </Field>
            </Section>

            {/* Restaurant Details */}
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
                {/* Quick-pick chips */}
                {form.cuisine.length === 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cuisineSuggestions.slice(0, 8).map(s => (
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
                )}
              </Field>
            </Section>

            {/* Address */}
            <Section label="Address" icon="location">
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={e => set('lat', e.target.value)}
                    placeholder="6.5244"
                    className={input('')}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={e => set('lng', e.target.value)}
                    placeholder="3.3792"
                    className={input('')}
                  />
                </Field>
              </div>
              <p className="text-xs text-gray-400 -mt-1">Optional — look up on Google Maps for accurate delivery radius. Defaults to Lagos if blank.</p>
            </Section>

            {/* Business Settings */}
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

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => { if (validate()) mutation.mutate() }}
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
