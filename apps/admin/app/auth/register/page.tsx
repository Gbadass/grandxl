'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AxiosError } from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi, myRestaurantApi, foodCategoriesApi } from '@grandxl/api-client'
import type { ApiError, FoodCategory, User } from '@grandxl/types'
import { UserRole } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import '../../../src/lib/axios'

// ── Constants ────────────────────────────────────────────────────────────────


const STEPS = [
  { n: 1, label: 'Create account',      desc: 'Your personal login details'         },
  { n: 2, label: 'Restaurant details',  desc: 'Name, cuisine and contact info'       },
  { n: 3, label: 'Location',            desc: 'Where customers will find you'        },
  { n: 4, label: 'Delivery settings',   desc: 'Fees, hours and delivery range'       },
] as const

type StepNumber = 1 | 2 | 3 | 4

const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 }

async function geocodeAddress(
  street: string,
  city: string,
  state: string,
): Promise<{ lat: number; lng: number }> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''
  if (!key) return NIGERIA_CENTER
  try {
    const q = encodeURIComponent(`${street}, ${city}, ${state}, Nigeria`)
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`,
    )
    const data = await res.json() as {
      status: string
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>
    }
    if (data.status === 'OK' && data.results.length) {
      return data.results[0].geometry.location
    }
  } catch { /* fall through */ }
  return NIGERIA_CENTER
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AccountState {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

interface RestaurantState {
  name: string
  description: string
  phone: string
  email: string
  cuisine: string[]
}

interface LocationState {
  street: string
  city: string
  state: string
}

interface OpsState {
  deliveryFee: string
  minOrderAmount: string
  deliveryTime: string
  deliveryRadius: string
}

// ── Shared UI components ──────────────────────────────────────────────────────

function FieldInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  required = true,
  readOnly = false,
}: {
  label: string
  type?: string
  value: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  hint?: string
  required?: boolean
  readOnly?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && !readOnly && <span className="ml-0.5 text-orange-500">*</span>}
        {!required && <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-orange-100 ${
          readOnly
            ? 'cursor-not-allowed border-gray-100 bg-gray-100 text-gray-500'
            : 'border-gray-200 bg-gray-50 focus:border-orange-400 focus:bg-white'
        }`}
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.7}
        stroke="currentColor"
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <p className="text-sm leading-relaxed text-blue-700">{children}</p>
    </div>
  )
}

// ── Error banner ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.7}
        stroke="currentColor"
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <p className="text-sm leading-relaxed text-red-700">{message}</p>
    </motion.div>
  )
}

// ── Step forms ────────────────────────────────────────────────────────────────

function Step1Form({
  account,
  onChange,
}: {
  account: AccountState
  onChange: (field: keyof AccountState) => (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-1.5 text-sm text-gray-500">Your personal login details for the partner portal</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldInput
          label="First name"
          value={account.firstName}
          onChange={onChange('firstName')}
          placeholder="Chidi"
        />
        <FieldInput
          label="Last name"
          value={account.lastName}
          onChange={onChange('lastName')}
          placeholder="Okonkwo"
        />
      </div>

      <FieldInput
        label="Email address"
        type="email"
        value={account.email}
        onChange={onChange('email')}
        placeholder="you@restaurant.com"
      />

      <FieldInput
        label="Phone number"
        type="tel"
        value={account.phone}
        onChange={onChange('phone')}
        placeholder="+2348012345678"
        hint="Include country code, e.g. +234 for Nigeria"
      />

      <FieldInput
        label="Password"
        type="password"
        value={account.password}
        onChange={onChange('password')}
        placeholder="Create a strong password"
        hint="At least 8 characters with 1 uppercase letter and 1 number"
      />

      <FieldInput
        label="Confirm password"
        type="password"
        value={account.confirmPassword}
        onChange={onChange('confirmPassword')}
        placeholder="Repeat your password"
      />
    </div>
  )
}

// Fallback used when the API is unreachable — matches DEFAULT_CATEGORIES in the service
const FALLBACK_CATEGORIES: FoodCategory[] = [
  { _id: 'rice',              name: 'Rice',               slug: 'rice',              sortOrder: 0,  isActive: true, image: null, createdBy: null },
  { _id: 'chicken',           name: 'Chicken',            slug: 'chicken',           sortOrder: 1,  isActive: true, image: null, createdBy: null },
  { _id: 'swallow',           name: 'Swallow',            slug: 'swallow',           sortOrder: 2,  isActive: true, image: null, createdBy: null },
  { _id: 'soups-stews',       name: 'Soups & Stews',      slug: 'soups-stews',       sortOrder: 3,  isActive: true, image: null, createdBy: null },
  { _id: 'burgers',           name: 'Burgers',            slug: 'burgers',           sortOrder: 4,  isActive: true, image: null, createdBy: null },
  { _id: 'pizza',             name: 'Pizza',              slug: 'pizza',             sortOrder: 5,  isActive: true, image: null, createdBy: null },
  { _id: 'shawarma',          name: 'Shawarma',           slug: 'shawarma',          sortOrder: 6,  isActive: true, image: null, createdBy: null },
  { _id: 'grills-suya',       name: 'Grills & Suya',      slug: 'grills-suya',       sortOrder: 7,  isActive: true, image: null, createdBy: null },
  { _id: 'seafood',           name: 'Seafood',            slug: 'seafood',           sortOrder: 8,  isActive: true, image: null, createdBy: null },
  { _id: 'fast-food',         name: 'Fast Food',          slug: 'fast-food',         sortOrder: 9,  isActive: true, image: null, createdBy: null },
  { _id: 'snacks',            name: 'Snacks',             slug: 'snacks',            sortOrder: 10, isActive: true, image: null, createdBy: null },
  { _id: 'breakfast',         name: 'Breakfast',          slug: 'breakfast',         sortOrder: 11, isActive: true, image: null, createdBy: null },
  { _id: 'continental',       name: 'Continental',        slug: 'continental',       sortOrder: 12, isActive: true, image: null, createdBy: null },
  { _id: 'chinese',           name: 'Chinese',            slug: 'chinese',           sortOrder: 13, isActive: true, image: null, createdBy: null },
  { _id: 'desserts',          name: 'Desserts',           slug: 'desserts',          sortOrder: 14, isActive: true, image: null, createdBy: null },
  { _id: 'drinks-smoothies',  name: 'Drinks & Smoothies', slug: 'drinks-smoothies',  sortOrder: 15, isActive: true, image: null, createdBy: null },
  { _id: 'wraps-sandwiches',  name: 'Wraps & Sandwiches', slug: 'wraps-sandwiches',  sortOrder: 16, isActive: true, image: null, createdBy: null },
  { _id: 'healthy',           name: 'Healthy',            slug: 'healthy',           sortOrder: 17, isActive: true, image: null, createdBy: null },
] as unknown as FoodCategory[]

function Step2Form({
  restaurant,
  onChangeField,
  onToggleCuisine,
}: {
  restaurant: RestaurantState
  onChangeField: (
    field: keyof RestaurantState,
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onToggleCuisine: (slug: string) => void
}) {
  const [categories, setCategories] = useState<FoodCategory[]>(FALLBACK_CATEGORIES)
  const [loadingCats, setLoadingCats] = useState(true)
  const [catError, setCatError] = useState<string | null>(null)

  useEffect(() => {
    foodCategoriesApi
      .getAll()
      .then((res) => {
        const data = res.data.data
        if (Array.isArray(data) && data.length > 0) setCategories(data)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[register] Failed to load food categories from API:', msg, err)
        setCatError(msg)
      })
      .finally(() => setLoadingCats(false))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Restaurant details</h2>
        <p className="mt-1.5 text-sm text-gray-500">This information will appear on your public listing</p>
      </div>

      <FieldInput
        label="Restaurant name"
        value={restaurant.name}
        onChange={onChangeField('name') as (e: ChangeEvent<HTMLInputElement>) => void}
        placeholder="e.g. Mama Chidi Kitchen"
      />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Description
          <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          value={restaurant.description}
          onChange={onChangeField('description') as (e: ChangeEvent<HTMLTextAreaElement>) => void}
          placeholder="Tell customers what makes your restaurant special…"
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldInput
          label="Restaurant phone"
          type="tel"
          value={restaurant.phone}
          onChange={onChangeField('phone') as (e: ChangeEvent<HTMLInputElement>) => void}
          placeholder="+2348012345678"
        />
        <FieldInput
          label="Restaurant email"
          type="email"
          value={restaurant.email}
          onChange={onChangeField('email') as (e: ChangeEvent<HTMLInputElement>) => void}
          placeholder="hello@myrestaurant.com"
          required={false}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Cuisine types <span className="text-orange-500">*</span>
        </label>
        {catError && (
          <p className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            Could not load live categories ({catError}) — showing defaults. You can still continue.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {loadingCats && categories.length === 0 && (
            <p className="text-xs text-gray-400">Loading categories…</p>
          )}
          {categories.map((c) => {
            const active = restaurant.cuisine.includes(c.slug)
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => onToggleCuisine(c.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm shadow-orange-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/50'
                }`}
              >
                {c.name}
              </button>
            )
          })}
        </div>
        {restaurant.cuisine.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            {restaurant.cuisine.length} selected
          </p>
        )}
      </div>
    </div>
  )
}

type ACSuggestion = { description: string; place_id: string }

function Step3Form({
  location,
  onChange,
  onFillLocation,
}: {
  location: LocationState
  onChange: (field: keyof LocationState) => (e: ChangeEvent<HTMLInputElement>) => void
  onFillLocation: (data: { street: string; city: string; state: string }) => void
}) {
  const [query, setQuery]         = useState('')
  const [suggestions, setSug]     = useState<ACSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [open, setOpen]           = useState(false)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                = useRef<HTMLDivElement>(null)

  // Debounced search via Next.js API route → Google Places REST (no SDK, no CORS issues)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 3) { setSug([]); setOpen(false); setSearchErr(''); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchErr('')
      try {
        const res  = await fetch(`/api/places?q=${encodeURIComponent(q)}`)
        const data = await res.json() as { suggestions?: ACSuggestion[]; status?: string }
        if (data.status && data.status !== 'OK') {
          setSearchErr(`Google returned: ${data.status}`)
          setSug([]); setOpen(false)
        } else {
          setSug(data.suggestions ?? [])
          setOpen((data.suggestions?.length ?? 0) > 0)
        }
      } catch (e) {
        setSearchErr('Search failed — check your connection')
        setSug([]); setOpen(false)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  async function handleSelect(s: ACSuggestion) {
    setQuery(s.description.split(',').slice(0, 2).join(',').trim())
    setSug([]); setOpen(false)

    try {
      const res  = await fetch(`/api/places/details?placeId=${encodeURIComponent(s.place_id)}`)
      const data = await res.json() as {
        result?: { formatted_address?: string; address_components?: Array<{ long_name: string; types: string[] }> }
      }
      const comps = data.result?.address_components ?? []
      let num = '', road = '', sub = '', city = '', state = ''
      for (const c of comps) {
        if (c.types.includes('street_number'))               num   = c.long_name
        if (c.types.includes('route'))                       road  = c.long_name
        if (c.types.includes('sublocality_level_1'))         sub   = c.long_name
        if (c.types.includes('locality'))                    city  = c.long_name
        if (c.types.includes('administrative_area_level_2')) city  = city || c.long_name
        if (c.types.includes('administrative_area_level_1')) state = c.long_name
      }
      const street = [num, road].filter(Boolean).join(' ') || sub || s.description.split(',')[0]?.trim() || ''
      onFillLocation({ street, city, state })
    } catch {
      // Fallback: parse from the suggestion text
      const parts = s.description.split(',')
      onFillLocation({ street: parts[0]?.trim() ?? '', city: parts[1]?.trim() ?? '', state: parts[2]?.trim() ?? '' })
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Restaurant location</h2>
        <p className="mt-1.5 text-sm text-gray-500">Where customers can find and order from you</p>
      </div>

      <InfoBox>
        We use this address to pin your restaurant on the map and calculate delivery distances
        for customers in your area.
      </InfoBox>

      {/* Address search — AutocompleteService (no DOM widget, no React conflict) */}
      <div ref={wrapperRef} className="relative">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Search your address <span className="text-orange-500">*</span>
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            {searching ? (
              <svg className="h-4 w-4 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Type your address or landmark…"
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        {searchErr ? (
          <p className="mt-1 text-xs text-red-500">{searchErr}</p>
        ) : (
          <p className="mt-1 text-xs text-gray-400">Powered by Google Maps · Nigeria</p>
        )}

        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-orange-50"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-orange-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="leading-snug text-gray-700">{s.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fields — auto-filled on selection, always editable */}
      <div className={`space-y-4 rounded-xl border p-4 transition-colors ${
        location.street || location.city ? 'border-orange-100 bg-orange-50/30' : 'border-gray-100 bg-gray-50/50'
      }`}>
        {(location.street || location.city) && (
          <p className="text-xs font-medium text-orange-600">Address found — review or correct below</p>
        )}
        <FieldInput label="Street address" value={location.street} onChange={onChange('street')} placeholder="e.g. 14 Padre Pio Street" />
        <div className="grid grid-cols-2 gap-4">
          <FieldInput label="City"  value={location.city}  onChange={onChange('city')}  placeholder="Makurdi" />
          <FieldInput label="State" value={location.state} onChange={onChange('state')} placeholder="Benue"   />
        </div>
        <FieldInput label="Country" value="Nigeria" readOnly />
      </div>
    </div>
  )
}

function Step4Form({
  ops,
  onChange,
}: {
  ops: OpsState
  onChange: (field: keyof OpsState) => (e: ChangeEvent<HTMLInputElement>) => void
}) {
  const fields: Array<{
    key: keyof OpsState
    label: string
    prefix?: string
    suffix?: string
    min: number
    placeholder: string
  }> = [
    { key: 'deliveryFee',    label: 'Delivery fee',       prefix: '₦', min: 0,  placeholder: '500'  },
    { key: 'minOrderAmount', label: 'Min order amount',   prefix: '₦', min: 0,  placeholder: '1000' },
    { key: 'deliveryTime',   label: 'Est. delivery time', suffix: 'mins', min: 5,  placeholder: '30'   },
    { key: 'deliveryRadius', label: 'Delivery radius',    suffix: 'km',   min: 1,  placeholder: '5'    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Delivery settings</h2>
        <p className="mt-1.5 text-sm text-gray-500">Configure how you deliver to your customers</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {f.label} <span className="text-orange-500">*</span>
            </label>
            <div className="relative">
              {f.prefix && (
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">
                  {f.prefix}
                </span>
              )}
              <input
                type="number"
                min={f.min}
                value={ops[f.key]}
                onChange={onChange(f.key)}
                placeholder={f.placeholder}
                className={`w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm text-gray-900 placeholder-gray-400 transition focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 ${
                  f.prefix ? 'pl-7 pr-4' : f.suffix ? 'pl-4 pr-14' : 'px-4'
                }`}
              />
              {f.suffix && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                  {f.suffix}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <InfoBox>
        You can update all these settings anytime from your restaurant dashboard once you are approved.
      </InfoBox>
    </div>
  )
}

// ── Done screen ───────────────────────────────────────────────────────────────

function DoneScreen({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-xl shadow-black/5"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 ring-8 ring-orange-50/50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-8 w-8 text-orange-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-gray-900">Application submitted!</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Our team reviews every application within{' '}
            <strong className="text-gray-700">24–48 hours</strong>. We&apos;ll email you when
            you&apos;re approved and ready to go live.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-8 space-y-3"
        >
          <button
            onClick={onGoToDashboard}
            className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 active:scale-[0.98]"
          >
            Go to my dashboard →
          </button>
          <p className="text-xs text-gray-400">
            Questions?{' '}
            <a href="mailto:partners@grandxl.com" className="text-orange-600 hover:underline">
              Contact partner support
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ── Horizontal step progress bar ──────────────────────────────────────────────

function HorizontalStepBar({ current }: { current: StepNumber }) {
  return (
    <div className="mb-6">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const done = current > step.n
          const active = current === step.n
          const isLast = idx === STEPS.length - 1

          return (
            <div key={step.n} className="flex flex-1 items-center">
              {/* Circle + label column */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    done
                      ? 'bg-orange-500'
                      : active
                      ? 'bg-orange-500 ring-4 ring-orange-100'
                      : 'border-2 border-gray-200 bg-white'
                  }`}
                >
                  {done ? (
                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <span
                      className={`text-[10px] font-bold leading-none ${
                        active ? 'text-white' : 'text-gray-400'
                      }`}
                    >
                      {step.n}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium leading-none transition-colors ${
                    active ? 'font-bold text-orange-500' : done ? 'text-orange-400' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-1.5 mb-4 h-0.5 flex-1 rounded-full transition-all duration-500">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      current > step.n ? 'bg-orange-400' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── FAQ Accordion ─────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'How long does the approval process take?',
    a: 'Our team reviews every application within 24 hours. You\'ll receive an email once you\'re approved and ready to go live.',
  },
  {
    q: 'Is there a registration or setup fee?',
    a: 'No. Registration is completely free. During our beta period, we also charge zero commission on orders.',
  },
  {
    q: 'What happens after I register?',
    a: 'After submitting your application, our team verifies your details and approves your listing. You\'ll get access to your restaurant dashboard where you can set up your menu and start receiving orders.',
  },
  {
    q: 'Can I update my delivery settings later?',
    a: 'Yes. All delivery settings — fee, radius, minimum order, and estimated time — can be updated anytime from your restaurant dashboard.',
  },
  {
    q: 'How do I receive my payments?',
    a: 'Payments are processed weekly directly to your bank account. You\'ll see a full breakdown of orders and earnings in your dashboard.',
  },
]

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-2xl divide-y divide-gray-100">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={i} className="py-5">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span className="text-base font-semibold text-gray-900">{item.q}</span>
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  isOpen ? 'border-orange-400 bg-orange-50 text-orange-500' : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <p className="pt-3 text-sm leading-relaxed text-gray-500">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Session persistence helpers ───────────────────────────────────────────────

const SS = 'gxl_reg'

function ssGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(`${SS}_${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function ssClear() {
  ;['step', 'account', 'restaurant', 'location', 'ops'].forEach((k) =>
    sessionStorage.removeItem(`${SS}_${k}`),
  )
}

// ── Page component ────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  // Server-safe defaults — identical on server and client first render (no hydration mismatch)
  const [step,       setStep]       = useState<StepNumber>(1)
  const [direction,  setDirection]  = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [done,       setDone]       = useState(false)
  const [welcomeBack,    setWelcomeBack]    = useState(false)
  const [welcomePass,    setWelcomePass]    = useState('')
  const [welcomeShowPwd, setWelcomeShowPwd] = useState(false)
  const [welcomeError,   setWelcomeError]   = useState('')
  const [welcomeLoading, setWelcomeLoading] = useState(false)

  const [account, setAccount] = useState<AccountState>({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
  })
  const [restaurant, setRestaurant] = useState<RestaurantState>({
    name: '', description: '', phone: '', email: '', cuisine: [],
  })
  const [location, setLocation] = useState<LocationState>({ street: '', city: '', state: '' })
  const [ops,      setOps]      = useState<OpsState>({
    deliveryFee: '500', minOrderAmount: '1000', deliveryTime: '30', deliveryRadius: '5',
  })

  // After hydration: restore saved progress from sessionStorage (client-only)
  useEffect(() => {
    const n = ssGet<number>('step', 1)
    setStep(([1, 2, 3, 4].includes(n) ? n : 1) as StepNumber)

    const acc = ssGet<Omit<AccountState, 'password' | 'confirmPassword'> | null>('account', null)
    if (acc) setAccount((p) => ({ ...p, ...acc, password: '', confirmPassword: '' }))

    const rest = ssGet<RestaurantState | null>('restaurant', null)
    if (rest) setRestaurant(rest)

    const loc = ssGet<LocationState | null>('location', null)
    if (loc) setLocation(loc)

    const o = ssGet<OpsState | null>('ops', null)
    if (o) setOps(o)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once after mount

  // Sync state → sessionStorage on every change (passwords never persisted)
  useEffect(() => { sessionStorage.setItem(`${SS}_step`, JSON.stringify(step)) }, [step])
  useEffect(() => {
    const { password: _p, confirmPassword: _c, ...safe } = account
    sessionStorage.setItem(`${SS}_account`, JSON.stringify(safe))
  }, [account])
  useEffect(() => { sessionStorage.setItem(`${SS}_restaurant`, JSON.stringify(restaurant)) }, [restaurant])
  useEffect(() => { sessionStorage.setItem(`${SS}_location`, JSON.stringify(location)) }, [location])
  useEffect(() => { sessionStorage.setItem(`${SS}_ops`, JSON.stringify(ops)) }, [ops])

  // ── Field change helpers ────────────────────────────────────────────────────

  function changeAccount(field: keyof AccountState) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setAccount((p) => ({ ...p, [field]: e.target.value }))
  }

  function changeRestaurant(field: keyof RestaurantState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setRestaurant((p) => ({ ...p, [field]: e.target.value }))
  }

  function changeLocation(field: keyof LocationState) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setLocation((p) => ({ ...p, [field]: e.target.value }))
  }

  function changeOps(field: keyof OpsState) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setOps((p) => ({ ...p, [field]: e.target.value }))
  }

  function toggleCuisine(c: string) {
    setRestaurant((p) => ({
      ...p,
      cuisine: p.cuisine.includes(c)
        ? p.cuisine.filter((x) => x !== c)
        : [...p.cuisine, c],
    }))
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function goBack() {
    if (step <= 1) return
    setError('')
    setDirection(-1)
    setStep((s) => (s - 1) as StepNumber)
  }

  function advance() {
    setDirection(1)
    setStep((s) => (s + 1) as StepNumber)
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    if (!account.firstName.trim() || !account.lastName.trim()) return 'Please enter your full name.'
    if (!account.email.trim()) return 'Email address is required.'
    if (!account.phone.trim()) return 'Phone number is required.'
    if (account.password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(account.password)) return 'Password must contain at least one uppercase letter.'
    if (!/[0-9]/.test(account.password)) return 'Password must contain at least one number.'
    if (account.password !== account.confirmPassword) return 'Passwords do not match.'
    return null
  }

  function validateStep2(): string | null {
    if (!restaurant.name.trim()) return 'Restaurant name is required.'
    if (!restaurant.phone.trim()) return 'Restaurant phone number is required.'
    if (restaurant.cuisine.length === 0) return 'Please select at least one cuisine type.'
    return null
  }

  function validateStep3(): string | null {
    if (!location.street.trim()) return 'Street address is required.'
    if (!location.city.trim()) return 'City is required.'
    if (!location.state.trim()) return 'State is required.'
    return null
  }

  function validateStep4(): string | null {
    const fee = Number(ops.deliveryFee)
    const min = Number(ops.minOrderAmount)
    const time = Number(ops.deliveryTime)
    const radius = Number(ops.deliveryRadius)
    if (isNaN(fee) || fee < 0) return 'Delivery fee must be a valid number.'
    if (isNaN(min) || min < 0) return 'Minimum order amount must be a valid number.'
    if (isNaN(time) || time <= 0) return 'Estimated delivery time must be a positive number.'
    if (isNaN(radius) || radius <= 0) return 'Delivery radius must be a positive number.'
    return null
  }

  // ── Step handlers ───────────────────────────────────────────────────────────

  function handleContinue() {
    setError('')
    let err: string | null = null

    if (step === 1) err = validateStep1()
    else if (step === 2) err = validateStep2()
    else if (step === 3) err = validateStep3()

    if (err) {
      setError(err)
      return
    }

    // Pre-fill restaurant phone from account on step 1 → 2
    if (step === 1 && !restaurant.phone) {
      setRestaurant((p) => ({ ...p, phone: account.phone }))
    }

    advance()
  }

  // Shared step: geocode + create restaurant. Used by both the fresh-register flow and welcome-back flow.
  async function createRestaurantStep() {
    const coords = await geocodeAddress(
      location.street.trim(),
      location.city.trim(),
      location.state.trim(),
    )

    await myRestaurantApi.create({
      name: restaurant.name.trim(),
      description: restaurant.description.trim() || undefined,
      phone: restaurant.phone.trim(),
      email: restaurant.email.trim() || undefined,
      cuisine: restaurant.cuisine,
      address: {
        street: location.street.trim(),
        city: location.city.trim(),
        state: location.state.trim(),
        country: 'NG',
        coordinates: coords,
      },
      deliveryFeeFixed: Math.round(Number(ops.deliveryFee) * 100),
      minOrderAmount: Math.round(Number(ops.minOrderAmount) * 100),
      estimatedDeliveryTime: Number(ops.deliveryTime),
      deliveryRadius: Number(ops.deliveryRadius),
    })

    ssClear()
    setDone(true)
  }

  async function handleSubmit() {
    setError('')
    const err = validateStep4()
    if (err) { setError(err); return }

    setLoading(true)
    try {
      // Already authenticated from a previous welcome-back step? Skip to restaurant creation.
      const pre = useAuthStore.getState()
      if (pre.isAuthenticated && pre.accessToken) {
        await createRestaurantStep()
        return
      }

      try {
        const authRes = await authApi.register({
          firstName: account.firstName.trim(),
          lastName: account.lastName.trim(),
          email: account.email.trim(),
          phone: account.phone.trim(),
          password: account.password,
          role: UserRole.RESTAURANT_OWNER,
          country: 'NG',
          consentGiven: true,
        })
        setAuth(authRes.data.data.user, authRes.data.data.accessToken)
      } catch (regErr) {
        if (regErr instanceof AxiosError) {
          const data = regErr.response?.data as (ApiError & { code?: string }) | undefined
          // Backend signaled an existing account — open the welcome-back modal.
          if (data?.code === 'ACCOUNT_EXISTS' || regErr.response?.status === 409) {
            setWelcomeBack(true)
            setWelcomePass('')
            setWelcomeError('')
            return
          }
          setError(data?.message ?? 'Registration failed.')
        } else {
          setError('Registration failed. Please try again.')
        }
        return
      }

      await createRestaurantStep()
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiError | undefined
        setError(data?.message ?? 'Something went wrong. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleWelcomeBack() {
    setWelcomeError('')
    if (!welcomePass.trim()) { setWelcomeError('Enter your password to continue.'); return }

    setWelcomeLoading(true)
    try {
      const res = await authApi.verifyAndAddRole({
        email: account.email.trim() || undefined,
        phone: account.phone.trim() || undefined,
        password: welcomePass,
        role: UserRole.RESTAURANT_OWNER,
      })
      setAuth(res.data.data.user, res.data.data.accessToken)
      setWelcomeBack(false)

      // Proceed straight to restaurant creation
      await createRestaurantStep()
    } catch (err) {
      if (err instanceof AxiosError) {
        const data = err.response?.data as ApiError | undefined
        setWelcomeError(data?.message ?? 'Invalid password.')
      } else {
        setWelcomeError('Something went wrong. Please try again.')
      }
    } finally {
      setWelcomeLoading(false)
    }
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (done) {
    return <DoneScreen onGoToDashboard={() => router.push('/restaurant/dashboard')} />
  }

  // ── Slide variants ──────────────────────────────────────────────────────────

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -32, opacity: 0 }),
  }

  const isLastStep = step === 4

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* ── Welcome-back modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {welcomeBack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0,  scale: 1   }}
              exit={{    opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-7 w-7 text-orange-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Welcome back{account.firstName ? `, ${account.firstName.trim()}` : ''}!
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                We found an account with this {account.email.trim() ? 'email' : 'phone'}.
                Enter your password to add <strong className="text-gray-900">Restaurant Owner</strong>
                {' '}to your account and finish setting up <strong className="text-gray-900">{restaurant.name.trim() || 'your restaurant'}</strong>.
              </p>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-gray-700">Password</label>
                <div className="relative">
                  <input
                    type={welcomeShowPwd ? 'text' : 'password'}
                    value={welcomePass}
                    onChange={(e) => setWelcomePass(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleWelcomeBack() }}
                    placeholder="Your existing password"
                    autoFocus
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 pr-14 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setWelcomeShowPwd((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-gray-700"
                  >
                    {welcomeShowPwd ? (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>

                <Link
                  href="/auth/forgot-password"
                  className="mt-2 inline-block text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  Forgot password?
                </Link>
              </div>

              {welcomeError && (
                <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {welcomeError}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setWelcomeBack(false); setDirection(-1); setStep(1) }}
                  disabled={welcomeLoading}
                  className="flex-1 rounded-full border border-gray-200 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Use another email
                </button>
                <motion.button
                  type="button"
                  onClick={() => { void handleWelcomeBack() }}
                  disabled={welcomeLoading}
                  whileHover={{ scale: welcomeLoading ? 1 : 1.015 }}
                  whileTap={{   scale: welcomeLoading ? 1 : 0.985 }}
                  className="flex-[1.4] rounded-full bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-60"
                >
                  {welcomeLoading ? 'Verifying…' : 'Continue setup'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed Navbar ────────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6 md:px-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="GrandXL" className="h-9 w-auto object-contain" />
        <Link
          href="/auth/login"
          className="text-sm font-medium text-gray-600 transition hover:text-orange-600"
        >
          Already a partner?{' '}
          <span className="font-semibold text-orange-600">Sign in</span>
        </Link>
      </nav>

      {/* ── Hero section ────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-orange-50 to-amber-50 pt-16">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-start gap-12 px-6 py-16 lg:flex-row lg:items-center lg:gap-16 lg:px-10">

          {/* LEFT column */}
          <div className="w-full lg:w-[52%]">
            {/* Eyebrow */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-orange-600">
              For restaurant partners
            </p>

            {/* Headline */}
            <h1 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
              Build your restaurant online with GrandXL
            </h1>

            {/* Sub */}
            <p className="mt-4 text-lg leading-relaxed text-gray-500">
              Register in minutes. Go live in 24 hours. Zero commission during beta.
            </p>

            {/* White form card */}
            <div className="mt-10 rounded-2xl bg-white p-6 shadow-xl shadow-black/[0.08] md:p-8">

              {/* Horizontal step bar */}
              <HorizontalStepBar current={step} />

              {/* Step form with slide animation */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {step === 1 && (
                    <Step1Form account={account} onChange={changeAccount} />
                  )}
                  {step === 2 && (
                    <Step2Form
                      restaurant={restaurant}
                      onChangeField={changeRestaurant}
                      onToggleCuisine={toggleCuisine}
                    />
                  )}
                  {step === 3 && (
                    <Step3Form
                      location={location}
                      onChange={changeLocation}
                      onFillLocation={(data) => setLocation((p) => ({ ...p, ...data }))}
                    />
                  )}
                  {step === 4 && (
                    <Step4Form ops={ops} onChange={changeOps} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Error banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <div className="mt-5">
                    <ErrorBanner key="error" message={error} />
                  </div>
                )}
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="mt-6 flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={loading}
                    className="rounded-full border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    ← Back
                  </button>
                )}

                <motion.button
                  type="button"
                  onClick={isLastStep ? handleSubmit : handleContinue}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.012 }}
                  whileTap={{ scale: loading ? 1 : 0.978 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                  className="flex w-full flex-1 items-center justify-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Submitting…
                    </>
                  ) : isLastStep ? (
                    'Submit application'
                  ) : (
                    'Continue →'
                  )}
                </motion.button>
              </div>
            </div>

            {/* Sign-in link below card (step 1 only) */}
            {step === 1 && (
              <p className="mt-5 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/auth/login" className="font-semibold text-orange-600 hover:underline">
                  Sign in
                </Link>
              </p>
            )}
          </div>

          {/* RIGHT column — photo + testimonial */}
          <div className="relative hidden w-full lg:block lg:w-[48%]">
            <div className="relative overflow-hidden rounded-3xl" style={{ height: '620px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=800&q=80"
                alt="Restaurant partner cooking"
                className="h-full w-full object-cover"
              />
              {/* Dark gradient overlay on bottom 40% */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/80 to-transparent" />

              {/* Testimonial card overlaid at bottom */}
              <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400"
                  >
                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
                  </svg>
                  <div>
                    <p className="text-sm leading-relaxed text-gray-700">
                      Since joining GrandXL, our orders doubled in the first month. The team was so helpful during setup.
                    </p>
                    <p className="mt-2 text-xs font-semibold text-gray-500">
                      Emeka Obi · Mama Chidi Kitchen, Makurdi
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits strip ───────────────────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          <h2 className="text-center text-2xl font-extrabold text-gray-900 md:text-3xl">
            Why over 180 restaurants choose GrandXL
          </h2>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {/* Benefit 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                ⚡
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">Live in 24 hours</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Every application reviewed by a real person within 24 hours.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                ₦
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">Zero commission</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Keep 100% of every order during our beta. Full transparency on any changes.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
                💬
              </div>
              <h3 className="mt-5 text-base font-bold text-gray-900">Real support</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                WhatsApp and email support 7 days a week from a team that knows your restaurant.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dark testimonial section ─────────────────────────────────────────── */}
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 px-6 md:flex-row md:gap-16 md:px-10">

          {/* Circular photo */}
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=400&q=80"
              alt="Aisha Mohammed, Spice Garden Restaurant"
              className="h-64 w-64 rounded-full border-4 border-orange-500 object-cover shadow-2xl"
            />
          </div>

          {/* Quote */}
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="mb-4 h-8 w-8 text-orange-500"
            >
              <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
            </svg>
            <blockquote className="text-xl font-medium leading-relaxed text-white md:text-2xl">
              GrandXL makes a real difference. Since we partnered with them, our restaurant has been reaching customers we never had before.
            </blockquote>
            <p className="mt-5 text-sm font-semibold text-orange-400">
              Aisha Mohammed · Spice Garden Restaurant, Benue
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ section ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <h2 className="text-center text-2xl font-extrabold text-gray-900 md:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-orange-500" />

          <div className="mt-12">
            <FaqAccordion />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row md:px-10">
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GrandXL" className="h-10 w-auto object-contain brightness-0 invert" />

          {/* Copyright */}
          <p className="text-sm text-zinc-500">
            &copy; 2026 GrandXL Technologies Ltd.
          </p>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Sign in
            </Link>
            <a
              href="mailto:partners@grandxl.com"
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Contact us
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}
