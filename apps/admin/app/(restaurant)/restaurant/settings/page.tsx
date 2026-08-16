'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, uploadsApi, type UpdateRestaurantDto } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { OpeningHours, BankDetails } from '@grandxl/types'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import '../../../../src/lib/axios'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

const DEFAULT_HOURS: OpeningHours = {
  monday:    { open: '08:00', close: '22:00', isOpen: true },
  tuesday:   { open: '08:00', close: '22:00', isOpen: true },
  wednesday: { open: '08:00', close: '22:00', isOpen: true },
  thursday:  { open: '08:00', close: '22:00', isOpen: true },
  friday:    { open: '08:00', close: '23:00', isOpen: true },
  saturday:  { open: '09:00', close: '23:00', isOpen: true },
  sunday:    { open: '10:00', close: '21:00', isOpen: true },
}

const CUISINE_SUGGESTIONS = [
  'Nigerian', 'Fast Food', 'Chinese', 'Indian', 'Italian', 'Lebanese',
  'Continental', 'Grills', 'Seafood', 'Pizza', 'Burgers', 'Shawarma',
  'Pastries & Bakes', 'Healthy', 'Vegan', 'Soups & Stews', 'Rice Dishes',
]

interface AddressState {
  street: string
  city: string
  state: string
  lat: number | null
  lng: number | null
  geocoded: boolean
}

async function geocodeAddress(street: string, city: string, state: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return null
  const q = encodeURIComponent(`${street}, ${city}, ${state}, Nigeria`)
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`)
  const data = await res.json() as { status: string; results: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[] }
  if (data.status !== 'OK' || !data.results[0]) return null
  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng, formatted: data.results[0].formatted_address }
}

export default function RestaurantSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    estimatedDeliveryTime: '',
    minOrderAmount: '',
    deliveryFeeFixed: '',
    deliveryRadius: '',
  })
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS)
  const [cuisine, setCuisine] = useState<string[]>([])
  const [cuisineInput, setCuisineInput] = useState('')
  const [address, setAddress] = useState<AddressState>({
    street: '', city: '', state: '', lat: null, lng: null, geocoded: false,
  })
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bankName: '',
    accountNumber: '',
    accountName: '',
  })
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [geocodedLabel, setGeocodedLabel] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const cuisineRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData, isLoading } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })

  const restaurant = restaurantsData?.data?.data?.[0]

  useEffect(() => {
    if (restaurant && !loaded) {
      setForm({
        name: restaurant.name,
        description: restaurant.description ?? '',
        phone: restaurant.phone,
        email: restaurant.email ?? '',
        estimatedDeliveryTime: String(restaurant.estimatedDeliveryTime ?? ''),
        minOrderAmount: ((restaurant.minOrderAmount ?? 0) / 100).toFixed(0),
        deliveryFeeFixed: ((restaurant.deliveryFeeFixed ?? 0) / 100).toFixed(0),
        deliveryRadius: String(restaurant.deliveryRadius ?? 5),
      })
      if (restaurant.openingHours) setHours(restaurant.openingHours)
      if (restaurant.cuisine?.length) setCuisine(restaurant.cuisine)
      if (restaurant.coverImage) setCoverImageUrl(restaurant.coverImage)
      if (restaurant.bankDetails) {
        setBankDetails({
          bankName: restaurant.bankDetails.bankName,
          accountNumber: restaurant.bankDetails.accountNumber,
          accountName: restaurant.bankDetails.accountName,
        })
      }
      if (restaurant.address) {
        const coords = restaurant.address.coordinates?.coordinates
        setAddress({
          street: restaurant.address.street ?? '',
          city: restaurant.address.city ?? '',
          state: restaurant.address.state ?? '',
          lat: coords ? coords[1] : null,
          lng: coords ? coords[0] : null,
          geocoded: !!coords,
        })
        if (coords) {
          setGeocodeStatus('found')
          setGeocodedLabel(`${restaurant.address.street}, ${restaurant.address.city}`)
        }
      }
      setLoaded(true)
    }
  }, [restaurant, loaded])

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    try {
      const res = await uploadsApi.uploadRestaurantCover(file)
      setCoverImageUrl(res.data.data.url)
      toast.success('Cover image uploaded')
    } catch {
      toast.error('Upload failed. Image must be JPG, PNG or WebP under 5 MB.')
    } finally {
      setCoverUploading(false)
      // Reset so the same file can be re-selected after removal
      e.target.value = ''
    }
  }

  async function handleGeocode() {
    if (!address.street || !address.city || !address.state) {
      toast.error('Enter street, city and state first')
      return
    }
    setGeocodeStatus('loading')
    const result = await geocodeAddress(address.street, address.city, address.state)
    if (result) {
      setAddress((a) => ({ ...a, lat: result.lat, lng: result.lng, geocoded: true }))
      setGeocodedLabel(result.formatted)
      setGeocodeStatus('found')
    } else {
      setGeocodeStatus('error')
      toast.error('Could not find coordinates for this address')
    }
  }

  function addCuisine(tag: string) {
    const clean = tag.trim()
    if (!clean || cuisine.includes(clean)) return
    setCuisine((c) => [...c, clean])
    setCuisineInput('')
  }

  function removeCuisine(tag: string) {
    setCuisine((c) => c.filter((t) => t !== tag))
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      const dto: UpdateRestaurantDto = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        estimatedDeliveryTime: form.estimatedDeliveryTime ? parseInt(form.estimatedDeliveryTime) : undefined,
        minOrderAmount: form.minOrderAmount ? Math.round(parseFloat(form.minOrderAmount) * 100) : undefined,
        deliveryFeeFixed: form.deliveryFeeFixed ? Math.round(parseFloat(form.deliveryFeeFixed) * 100) : undefined,
        deliveryRadius: form.deliveryRadius ? parseFloat(form.deliveryRadius) : undefined,
        openingHours: hours as unknown as Record<string, { open: string; close: string; isOpen: boolean }>,
        cuisine: cuisine.length ? cuisine : undefined,
        coverImage: coverImageUrl ?? null,
        bankDetails: (bankDetails.bankName || bankDetails.accountNumber || bankDetails.accountName)
          ? bankDetails
          : undefined,
      }
      if (address.geocoded && address.lat !== null && address.lng !== null) {
        dto.address = {
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          country: 'NG',
          coordinates: { lat: address.lat, lng: address.lng },
        }
      }
      return myRestaurantApi.update(restaurant!._id, dto)
    },
    onSuccess: () => {
      toast.success('Settings saved')
      void qc.invalidateQueries({ queryKey: ['my-restaurants'] })
    },
    onError: () => toast.error('Save failed'),
  })

  function setDay(day: typeof DAYS[number], field: 'open' | 'close' | 'isOpen', value: string | boolean) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }))
  }

  if (isInitializing || isLoading || !loaded) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />)}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Update your restaurant details" />

      <div className="max-w-2xl space-y-6">

        {/* Basic Info */}
        <Section title="Basic Info">
          <Field label="Restaurant name *">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone *">
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Cover Image */}
        <Section title="Cover Image">
          <p className="text-xs text-gray-500 -mt-2">
            This is the banner shown on your restaurant page and on listing cards. Recommended: 1200×480px, JPG or PNG.
          </p>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverUpload}
          />

          {coverImageUrl ? (
            <div className="relative group overflow-hidden rounded-xl border border-gray-200">
              {/* Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageUrl}
                alt="Restaurant cover"
                className="w-full h-48 object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 shadow-lg"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-lg"
                >
                  Remove
                </button>
              </div>
              {coverUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <svg className="h-8 w-8 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="w-full h-48 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {coverUploading ? (
                <>
                  <svg className="h-7 w-7 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm font-medium text-orange-500">Uploading…</span>
                </>
              ) : (
                <>
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 19.5h18M3.75 4.5h16.5a.75.75 0 01.75.75v11.25a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-semibold">Click to upload cover image</p>
                    <p className="text-xs mt-0.5">JPG, PNG or WebP · Max 5 MB</p>
                  </div>
                </>
              )}
            </button>
          )}
        </Section>

        {/* Cuisine Types */}
        <Section title="Cuisine Types">
          <p className="text-xs text-gray-500 -mt-2">Helps customers find you. Add at least one.</p>
          <div className="flex flex-wrap gap-2 min-h-[36px]">
            {cuisine.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                {tag}
                <button type="button" onClick={() => removeCuisine(tag)} className="ml-0.5 text-orange-400 hover:text-orange-600 leading-none">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={cuisineRef}
              value={cuisineInput}
              onChange={(e) => setCuisineInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCuisine(cuisineInput) }
              }}
              placeholder="Type cuisine and press Enter"
              className={inputCls + ' flex-1'}
            />
            <button
              type="button"
              onClick={() => addCuisine(cuisineInput)}
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CUISINE_SUGGESTIONS.filter((s) => !cuisine.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addCuisine(s)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </Section>

        {/* Location */}
        <Section title="Restaurant Location">
          <p className="text-xs text-gray-500 -mt-2">
            This is where riders navigate to pick up orders. Make sure it&apos;s accurate.
          </p>
          <div className="space-y-3">
            <Field label="Street address *">
              <input
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value, geocoded: false }))}
                placeholder="e.g. 15 Adeola Odeku Street"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City *">
                <input
                  value={address.city}
                  onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value, geocoded: false }))}
                  placeholder="e.g. Lagos"
                  className={inputCls}
                />
              </Field>
              <Field label="State *">
                <input
                  value={address.state}
                  onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value, geocoded: false }))}
                  placeholder="e.g. Lagos State"
                  className={inputCls}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocodeStatus === 'loading' || !address.street || !address.city || !address.state}
              className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              {geocodeStatus === 'loading' ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {geocodeStatus === 'loading' ? 'Finding location…' : 'Find on map'}
            </button>

            {geocodeStatus === 'found' && address.lat !== null && (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Location confirmed</p>
                  <p className="text-xs text-green-700 mt-0.5">{geocodedLabel}</p>
                  <p className="text-xs text-green-600 mt-0.5">{address.lat?.toFixed(6)}, {address.lng?.toFixed(6)}</p>
                </div>
              </div>
            )}

            {geocodeStatus === 'error' && (
              <p className="text-sm text-red-600">
                Could not find this address on the map. Try being more specific (include street number, area name).
              </p>
            )}

            {address.geocoded === false && address.lat !== null && geocodeStatus !== 'found' && (
              <p className="text-xs text-amber-600">
                ⚠ Address changed — click &quot;Find on map&quot; to update the coordinates before saving.
              </p>
            )}
          </div>
        </Section>

        {/* Delivery Settings */}
        <Section title="Delivery Settings">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Est. delivery (min)">
              <input type="number" min="5" max="180" value={form.estimatedDeliveryTime} onChange={(e) => setForm((f) => ({ ...f, estimatedDeliveryTime: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Delivery radius (km)">
              <input type="number" min="0.5" max="50" step="0.5" value={form.deliveryRadius} onChange={(e) => setForm((f) => ({ ...f, deliveryRadius: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Min order (₦)">
              <input type="number" min="0" value={form.minOrderAmount} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Delivery fee (₦)">
              <input type="number" min="0" value={form.deliveryFeeFixed} onChange={(e) => setForm((f) => ({ ...f, deliveryFeeFixed: e.target.value }))} className={inputCls} />
            </Field>
          </div>
        </Section>

        {/* Opening Hours */}
        <Section title="Opening Hours">
          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-28 flex-shrink-0 text-sm font-medium capitalize text-gray-700">{day}</span>
                <button
                  type="button"
                  onClick={() => setDay(day, 'isOpen', !hours[day].isOpen)}
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${hours[day].isOpen ? 'bg-orange-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hours[day].isOpen ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                {hours[day].isOpen ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hours[day].open}
                      onChange={(e) => setDay(day, 'open', e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                      type="time"
                      value={hours[day].close}
                      onChange={(e) => setDay(day, 'close', e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">Closed</span>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Bank Details */}
        <Section title="Bank Details">
          <p className="text-xs text-gray-500 -mt-2">Used for weekly payouts to your account.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name">
              <input
                value={bankDetails.bankName}
                onChange={(e) => setBankDetails((b) => ({ ...b, bankName: e.target.value }))}
                placeholder="e.g. GTBank"
                className={inputCls}
              />
            </Field>
            <Field label="Account Number">
              <input
                value={bankDetails.accountNumber}
                onChange={(e) => setBankDetails((b) => ({ ...b, accountNumber: e.target.value }))}
                maxLength={10}
                placeholder="0123456789"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Account Name">
            <input
              value={bankDetails.accountName}
              onChange={(e) => setBankDetails((b) => ({ ...b, accountName: e.target.value }))}
              placeholder="e.g. John Doe"
              className={inputCls}
            />
          </Field>
        </Section>

        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !form.name}
          className="rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-5 font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
