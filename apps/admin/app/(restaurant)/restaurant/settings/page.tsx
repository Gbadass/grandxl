'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, uploadsApi, type UpdateRestaurantDto } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { OpeningHours, BankDetails } from '@grandxl/types'
import { useAuthStore } from '../../../../src/store/auth.store'
import {
  User, Image as ImageIcon, MapPin, Truck, Clock, CreditCard,
  Plus, X, Check, Loader2, AlertCircle, ChevronRight, Copy,
  Images, ArrowLeft, ArrowRight,
} from 'lucide-react'
import '../../../../src/lib/axios'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type Day = typeof DAYS[number]

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

const NIGERIAN_BANKS = [
  'GTBank', 'Access Bank', 'Zenith Bank', 'First Bank', 'UBA',
  'Fidelity Bank', 'Union Bank', 'Sterling Bank', 'Polaris Bank',
  'Keystone Bank', 'Wema Bank', 'FCMB', 'Stanbic IBTC', 'Ecobank',
]

type TabKey = 'profile' | 'branding' | 'location' | 'delivery' | 'hours' | 'payout'

const TABS: { key: TabKey; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'profile',  label: 'Profile',   icon: <User size={16} />,       desc: 'Name, description, contact' },
  { key: 'branding', label: 'Branding',  icon: <ImageIcon size={16} />,  desc: 'Cover, logo & photo gallery' },
  { key: 'location', label: 'Location',  icon: <MapPin size={16} />,     desc: 'Address & coordinates'      },
  { key: 'delivery', label: 'Delivery',  icon: <Truck size={16} />,      desc: 'Fees, radius & minimums'    },
  { key: 'hours',    label: 'Hours',     icon: <Clock size={16} />,      desc: 'Opening times per day'      },
  { key: 'payout',   label: 'Payout',   icon: <CreditCard size={16} />, desc: 'Bank account for payouts'   },
]

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 ' +
  'focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 transition'

// ── Geocoding ─────────────────────────────────────────────────────────────────

interface AddressState {
  street: string
  city: string
  state: string
  lat: number | null
  lng: number | null
  geocoded: boolean
}

async function geocodeAddress(street: string, city: string, state: string) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return null
  const q = encodeURIComponent(`${street}, ${city}, ${state}, Nigeria`)
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`)
  const data = await res.json() as {
    status: string
    results: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[]
  }
  if (data.status !== 'OK' || !data.results[0]) return null
  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng, formatted: data.results[0].formatted_address }
}

// ── Helper components ─────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function InsetInput({
  prefix, suffix, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        {...props}
        className={`${inputCls} ${prefix ? 'pl-9' : ''} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 ${
        on ? 'bg-orange-500' : 'bg-gray-200'
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        on ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" />
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [dirty, setDirty] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', phone: '', email: '',
    estimatedDeliveryTime: '', minOrderAmount: '', deliveryFeeFixed: '', deliveryRadius: '',
  })
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS)
  const [cuisine, setCuisine] = useState<string[]>([])
  const [cuisineInput, setCuisineInput] = useState('')
  const [address, setAddress] = useState<AddressState>({ street: '', city: '', state: '', lat: null, lng: null, geocoded: false })
  const [bankDetails, setBankDetails] = useState<BankDetails>({ bankName: '', accountNumber: '', accountName: '' })
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle')
  const [geocodedLabel, setGeocodedLabel] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  // Sprint 12 (S12-9): photo gallery state
  const [gallery, setGallery] = useState<string[]>([])
  const [galleryUploading, setGalleryUploading] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const GALLERY_MAX = 12
  const [loaded, setLoaded] = useState(false)
  const [showBankNumber, setShowBankNumber] = useState(false)
  const [bankFilter, setBankFilter] = useState('')
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false)

  const coverInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const markDirty = useCallback(() => setDirty(true), [])

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

  // Populate form from API data (once)
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
      if (restaurant.logo) setLogoUrl(restaurant.logo)
      if (restaurant.gallery?.length) setGallery(restaurant.gallery)
      if (restaurant.bankDetails) setBankDetails(restaurant.bankDetails)
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

  // ── Upload handlers ──────────────────────────────────────────────────────

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    try {
      const res = await uploadsApi.uploadRestaurantCover(file)
      setCoverImageUrl(res.data.data.url)
      markDirty()
      toast.success('Cover image uploaded')
    } catch {
      toast.error('Upload failed — must be JPG, PNG or WebP under 5 MB.')
    } finally {
      setCoverUploading(false)
      e.target.value = ''
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const res = await uploadsApi.uploadRestaurantLogo(file)
      setLogoUrl(res.data.data.url)
      markDirty()
      toast.success('Logo uploaded')
    } catch {
      toast.error('Upload failed — must be JPG, PNG or WebP under 5 MB.')
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  // Sprint 12 (S12-9): gallery upload / reorder / remove
  //
  // Files are pushed through the existing restaurant-cover upload — same
  // Cloudinary folder, same 5 MB / JPG-PNG-WebP validation. We loop sequentially
  // rather than in parallel so a bad file surfaces a single toast instead of N
  // simultaneous ones, and to keep the "N of M uploaded" ordering intuitive.
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const remainingSlots = GALLERY_MAX - gallery.length
    if (remainingSlots <= 0) {
      toast.error(`Gallery is full (${GALLERY_MAX} photos max)`)
      return
    }
    if (files.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} slot${remainingSlots === 1 ? '' : 's'} left — trimming to fit`)
    }
    const toUpload = files.slice(0, remainingSlots)

    setGalleryUploading(true)
    try {
      for (const file of toUpload) {
        const res = await uploadsApi.uploadRestaurantCover(file)
        setGallery((g) => [...g, res.data.data.url])
      }
      markDirty()
      toast.success(`${toUpload.length} photo${toUpload.length === 1 ? '' : 's'} added — save to publish`)
    } catch {
      toast.error('Upload failed — files must be JPG, PNG or WebP under 5 MB.')
    } finally {
      setGalleryUploading(false)
    }
  }

  function removeGalleryPhoto(idx: number) {
    setGallery((g) => g.filter((_, i) => i !== idx))
    markDirty()
  }

  function moveGalleryPhoto(idx: number, dir: -1 | 1) {
    const to = idx + dir
    if (to < 0 || to >= gallery.length) return
    setGallery((g) => {
      const next = [...g]
      const [item] = next.splice(idx, 1)
      next.splice(to, 0, item!)
      return next
    })
    markDirty()
  }

  // ── Geocoding ────────────────────────────────────────────────────────────

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
      markDirty()
    } else {
      setGeocodeStatus('error')
      toast.error('Could not locate this address — try adding more detail')
    }
  }

  // ── Cuisine ──────────────────────────────────────────────────────────────

  function addCuisine(tag: string) {
    const clean = tag.trim()
    if (!clean || cuisine.includes(clean)) return
    setCuisine((c) => [...c, clean])
    setCuisineInput('')
    markDirty()
  }

  function removeCuisine(tag: string) {
    setCuisine((c) => c.filter((t) => t !== tag))
    markDirty()
  }

  // ── Opening hours ────────────────────────────────────────────────────────

  function setDay(day: Day, field: 'open' | 'close' | 'isOpen', value: string | boolean) {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: value } }))
    markDirty()
  }

  function applyToAllDays(day: Day) {
    const src = hours[day]
    const updated = { ...hours }
    DAYS.forEach((d) => { updated[d] = { ...src } })
    setHours(updated)
    markDirty()
    toast.success(`Applied ${day}'s hours to all days`)
  }

  // ── Save mutation ────────────────────────────────────────────────────────

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
        logo: logoUrl ?? null,
        gallery,
        bankDetails: (bankDetails.bankName || bankDetails.accountNumber || bankDetails.accountName)
          ? bankDetails : undefined,
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
      toast.success('Settings saved successfully')
      setDirty(false)
      void qc.invalidateQueries({ queryKey: ['my-restaurants'] })
    },
    onError: () => toast.error('Save failed — please try again'),
  })

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isInitializing || isLoading || !loaded) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 animate-pulse rounded-xl bg-gray-200" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-gray-100" />
        </div>
        <div className="flex gap-6">
          <div className="w-52 shrink-0 space-y-2">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            {[1,2,3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const descLen = form.description.length

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page header + save button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Settings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your restaurant profile and preferences</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {dirty && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="hidden sm:inline">Unsaved changes</span>
              <span className="sm:hidden">Unsaved</span>
            </span>
          )}
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !form.name.trim()}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 sm:px-5 text-sm font-bold text-white hover:bg-orange-700 active:bg-orange-800 disabled:opacity-60 transition-colors cursor-pointer min-w-[110px] justify-center"
          >
            {updateMutation.isPending ? (
              <><Spinner size={14} /> Saving…</>
            ) : (
              <><Check size={14} /> Save changes</>
            )}
          </button>
        </div>
      </div>

      {/* Mobile: horizontal scrollable tab bar */}
      <div className="md:hidden -mx-4 px-4 overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-max">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === key
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className={activeTab === key ? 'text-white' : 'text-gray-400'}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:items-start">
        {/* Left sidebar — desktop only */}
        <nav className="hidden md:block w-52 shrink-0 space-y-1">
          {TABS.map(({ key, label, icon, desc }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all cursor-pointer group ${
                activeTab === key
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={`shrink-0 ${activeTab === key ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold leading-none ${activeTab === key ? 'text-white' : ''}`}>{label}</p>
                <p className={`text-[11px] mt-0.5 truncate ${activeTab === key ? 'text-white/70' : 'text-gray-400'}`}>{desc}</p>
              </div>
              {activeTab === key && <ChevronRight size={14} className="shrink-0 text-white/70" />}
            </button>
          ))}
        </nav>

        {/* Main content area */}
        <div className="flex-1 min-w-0">

          {/* ── PROFILE ─────────────────────────────────────────────────── */}
          {activeTab === 'profile' && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
              <SectionHeader icon={<User size={18} />} title="Profile" desc="Your restaurant's public-facing information" />

              <Field label="Restaurant name *">
                <input
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); markDirty() }}
                  placeholder="e.g. Mama's Kitchen"
                  className={inputCls}
                />
              </Field>

              <Field label="Description" hint={`${descLen}/300 characters`}>
                <textarea
                  value={form.description}
                  onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value.slice(0, 300) })); markDirty() }}
                  rows={4}
                  placeholder="Tell customers what makes your food special…"
                  className={`${inputCls} resize-none`}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[11px] tabular-nums ${descLen > 270 ? 'text-amber-500' : descLen > 250 ? 'text-amber-400' : 'text-gray-300'}`}>
                    {descLen}/300
                  </span>
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone number *" hint="E.164 format: +2348012345678">
                  <input
                    value={form.phone}
                    onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); markDirty() }}
                    placeholder="+2348012345678"
                    className={inputCls}
                  />
                </Field>
                <Field label="Email address" hint="For order & support notifications">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); markDirty() }}
                    placeholder="restaurant@example.com"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Cuisine types */}
              <div className="space-y-3 border-t border-gray-50 pt-5">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Cuisine types</p>
                  <p className="text-xs text-gray-400 mt-0.5">Helps customers discover your restaurant. Add at least one.</p>
                </div>

                {/* Selected tags */}
                {cuisine.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cuisine.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeCuisine(tag)}
                          className="text-orange-300 hover:text-orange-600 transition-colors cursor-pointer leading-none"
                          aria-label={`Remove ${tag}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <input
                    value={cuisineInput}
                    onChange={(e) => setCuisineInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCuisine(cuisineInput) }
                    }}
                    placeholder="Type a cuisine and press Enter"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => addCuisine(cuisineInput)}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {/* Suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {CUISINE_SUGGESTIONS.filter((s) => !cuisine.includes(s)).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addCuisine(s)}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition-colors cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── BRANDING ────────────────────────────────────────────────── */}
          {activeTab === 'branding' && (
            <div className="space-y-5">
              {/* Cover image */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
                <SectionHeader icon={<ImageIcon size={18} />} title="Cover image" desc="Banner shown on your listing card and restaurant page · 1200×480px recommended" />

                <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />

                {coverImageUrl ? (
                  <div className="group relative overflow-hidden rounded-2xl border border-gray-200 aspect-[5/2]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImageUrl} alt="Restaurant cover" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={coverUploading}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-50 shadow-lg cursor-pointer transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCoverImageUrl(null); markDirty() }}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 shadow-lg cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    {coverUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
                        <Spinner size={20} /><span className="text-sm font-medium text-white">Uploading…</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    className="flex aspect-[5/2] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-500 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {coverUploading ? (
                      <><Spinner size={24} /><span className="text-sm font-medium text-orange-500">Uploading…</span></>
                    ) : (
                      <>
                        <ImageIcon size={32} />
                        <div className="text-center">
                          <p className="text-sm font-semibold">Click to upload cover image</p>
                          <p className="text-xs mt-0.5">JPG, PNG or WebP · Max 5 MB · 1200×480px ideal</p>
                        </div>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Logo */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
                <SectionHeader icon={<ImageIcon size={18} />} title="Restaurant logo" desc="Square logo shown in search results and order receipts · 400×400px recommended" />

                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoUpload} />

                <div className="flex items-start gap-5">
                  {logoUrl ? (
                    <div className="group relative h-28 w-28 overflow-hidden rounded-2xl border border-gray-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="Restaurant logo" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={logoUploading}
                          className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-900 shadow-lg cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                      {logoUploading && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Spinner size={16} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="h-28 w-28 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-500 transition-all cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      {logoUploading ? <Spinner size={20} /> : (
                        <>
                          <ImageIcon size={24} />
                          <span className="text-[11px] font-medium text-center leading-tight px-1">Upload logo</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Your logo appears in search results, on order receipts, and in your restaurant header.
                    </p>
                    <p className="text-xs text-gray-400">Square format · JPG, PNG or WebP · Max 5 MB</p>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => { setLogoUrl(null); markDirty() }}
                        className="text-xs font-medium text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sprint 12 (S12-9): Photo gallery */}
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-4">
                <SectionHeader
                  icon={<Images size={18} />}
                  title={`Photo gallery (${gallery.length}/${GALLERY_MAX})`}
                  desc="Extra photos of your food, space, and team — shown as a scrollable strip on your restaurant page"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleGalleryUpload}
                />

                {gallery.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={galleryUploading}
                    className="flex aspect-[5/2] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-500 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {galleryUploading ? (
                      <><Spinner size={24} /><span className="text-sm font-medium text-orange-500">Uploading…</span></>
                    ) : (
                      <>
                        <Images size={32} />
                        <div className="text-center">
                          <p className="text-sm font-semibold">Click to add up to {GALLERY_MAX} photos</p>
                          <p className="text-xs mt-0.5">JPG, PNG or WebP · Max 5 MB each · Multi-select supported</p>
                        </div>
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {gallery.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Gallery ${idx + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => moveGalleryPhoto(idx, -1)}
                              disabled={idx === 0}
                              aria-label="Move left"
                              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGalleryPhoto(idx, 1)}
                              disabled={idx === gallery.length - 1}
                              aria-label="Move right"
                              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowRight size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeGalleryPhoto(idx)}
                              aria-label="Remove photo"
                              className="h-8 w-8 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <span className="absolute top-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                            {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-gray-400">Drag the arrows to reorder · #1 shows first on your restaurant page</p>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={galleryUploading || gallery.length >= GALLERY_MAX}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {galleryUploading ? <Spinner size={14} /> : <Plus size={14} />}
                        Add more
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── LOCATION ────────────────────────────────────────────────── */}
          {activeTab === 'location' && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
              <SectionHeader icon={<MapPin size={18} />} title="Restaurant location" desc="Where riders navigate for pickups — must be precise" />

              <Field label="Street address *" hint="Include building number and street name">
                <input
                  value={address.street}
                  onChange={(e) => { setAddress((a) => ({ ...a, street: e.target.value, geocoded: false })); markDirty() }}
                  placeholder="e.g. 15 Adeola Odeku Street, Victoria Island"
                  className={inputCls}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City *">
                  <input
                    value={address.city}
                    onChange={(e) => { setAddress((a) => ({ ...a, city: e.target.value, geocoded: false })); markDirty() }}
                    placeholder="e.g. Lagos"
                    className={inputCls}
                  />
                </Field>
                <Field label="State *">
                  <input
                    value={address.state}
                    onChange={(e) => { setAddress((a) => ({ ...a, state: e.target.value, geocoded: false })); markDirty() }}
                    placeholder="e.g. Lagos State"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Geocode button */}
              <button
                type="button"
                onClick={handleGeocode}
                disabled={geocodeStatus === 'loading' || !address.street || !address.city || !address.state}
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {geocodeStatus === 'loading' ? (
                  <><Spinner size={14} /> Finding location…</>
                ) : (
                  <><MapPin size={14} /> Confirm on map</>
                )}
              </button>

              {/* Geocode result */}
              {geocodeStatus === 'found' && address.lat !== null && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                      <Check size={13} className="text-white" />
                    </div>
                    <p className="text-sm font-bold text-green-800">Location confirmed</p>
                  </div>
                  <p className="text-xs text-green-700 pl-8">{geocodedLabel}</p>
                  <div className="flex items-center gap-2 pl-8">
                    <p className="font-mono text-xs text-green-600">{address.lat?.toFixed(6)}, {address.lng?.toFixed(6)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${address.lat?.toFixed(6)}, ${address.lng?.toFixed(6)}`)
                        toast.success('Coordinates copied')
                      }}
                      className="text-green-400 hover:text-green-600 transition-colors cursor-pointer"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              )}

              {geocodeStatus === 'error' && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">
                    Address not found. Try adding more detail — include area name, landmark, or LGA.
                  </p>
                </div>
              )}

              {!address.geocoded && address.lat !== null && geocodeStatus !== 'found' && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    Address changed — click "Confirm on map" to update coordinates before saving.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── DELIVERY ────────────────────────────────────────────────── */}
          {activeTab === 'delivery' && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
              <SectionHeader icon={<Truck size={18} />} title="Delivery settings" desc="Controls visible to customers at checkout" />

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Estimated delivery time" hint="Average time from order confirmation to doorstep">
                  <InsetInput
                    type="number"
                    min="5"
                    max="180"
                    value={form.estimatedDeliveryTime}
                    onChange={(e) => { setForm((f) => ({ ...f, estimatedDeliveryTime: e.target.value })); markDirty() }}
                    placeholder="30"
                    suffix="min"
                  />
                </Field>

                <Field label="Delivery radius" hint="Maximum distance you're willing to deliver to">
                  <InsetInput
                    type="number"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={form.deliveryRadius}
                    onChange={(e) => { setForm((f) => ({ ...f, deliveryRadius: e.target.value })); markDirty() }}
                    placeholder="5"
                    suffix="km"
                  />
                </Field>

                <Field label="Minimum order amount" hint="Orders below this value won't be accepted">
                  <InsetInput
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => { setForm((f) => ({ ...f, minOrderAmount: e.target.value })); markDirty() }}
                    placeholder="1000"
                    prefix="₦"
                  />
                </Field>

                <Field label="Fixed delivery fee" hint="Flat fee added to every order at checkout">
                  <InsetInput
                    type="number"
                    min="0"
                    value={form.deliveryFeeFixed}
                    onChange={(e) => { setForm((f) => ({ ...f, deliveryFeeFixed: e.target.value })); markDirty() }}
                    placeholder="500"
                    prefix="₦"
                  />
                </Field>
              </div>

              {/* Preview strip */}
              {(form.estimatedDeliveryTime || form.deliveryRadius || form.minOrderAmount || form.deliveryFeeFixed) && (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 mt-2">
                  <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-widest">Customer sees</p>
                  <div className="flex flex-wrap gap-3">
                    {form.estimatedDeliveryTime && (
                      <div className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5">
                        <Clock size={12} className="text-orange-500" />
                        <span className="text-xs font-medium text-gray-700">{form.estimatedDeliveryTime}–{Math.round(parseInt(form.estimatedDeliveryTime) * 1.3)} min</span>
                      </div>
                    )}
                    {form.deliveryFeeFixed && (
                      <div className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5">
                        <Truck size={12} className="text-orange-500" />
                        <span className="text-xs font-medium text-gray-700">₦{parseInt(form.deliveryFeeFixed).toLocaleString()} delivery</span>
                      </div>
                    )}
                    {form.minOrderAmount && (
                      <div className="flex items-center gap-1.5 rounded-xl bg-white border border-gray-200 px-3 py-1.5">
                        <span className="text-xs font-medium text-gray-700">Min ₦{parseInt(form.minOrderAmount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HOURS ───────────────────────────────────────────────────── */}
          {activeTab === 'hours' && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
              <SectionHeader icon={<Clock size={18} />} title="Opening hours" desc="Set when your restaurant accepts orders each day" />

              <div className="space-y-2">
                {DAYS.map((day) => {
                  const dayHours = hours[day]
                  return (
                    <div
                      key={day}
                      className={`rounded-2xl px-4 py-3 transition-colors ${
                        dayHours.isOpen ? 'bg-gray-50' : 'bg-gray-50/50 opacity-60'
                      }`}
                    >
                      {/* Row 1: day name + toggle */}
                      <div className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-sm font-semibold capitalize text-gray-700">
                          {day.slice(0, 3).charAt(0).toUpperCase() + day.slice(1, 3)}
                          <span className="hidden sm:inline">{day.slice(3)}</span>
                        </span>
                        <Toggle on={dayHours.isOpen} onToggle={() => setDay(day, 'isOpen', !dayHours.isOpen)} />
                        {!dayHours.isOpen && (
                          <span className="text-sm text-gray-400 italic">Closed</span>
                        )}
                      </div>

                      {/* Row 2: time pickers — wraps under day name on mobile */}
                      {dayHours.isOpen && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:ml-24">
                          <input
                            type="time"
                            value={dayHours.open}
                            onChange={(e) => setDay(day, 'open', e.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition cursor-pointer"
                          />
                          <span className="text-xs font-medium text-gray-400">to</span>
                          <input
                            type="time"
                            value={dayHours.close}
                            onChange={(e) => setDay(day, 'close', e.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => applyToAllDays(day)}
                            title="Apply these hours to all days"
                            className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Apply all
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick-set shortcuts */}
              <div className="border-t border-gray-50 pt-4">
                <p className="text-xs font-semibold text-gray-400 mb-2.5 uppercase tracking-widest">Quick presets</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Mon–Fri only', fn: () => {
                      const u = { ...hours }
                      DAYS.forEach((d) => { u[d] = { ...u[d], isOpen: ['monday','tuesday','wednesday','thursday','friday'].includes(d) } })
                      setHours(u); markDirty()
                    }},
                    { label: 'All 7 days', fn: () => {
                      const u = { ...hours }
                      DAYS.forEach((d) => { u[d] = { ...u[d], isOpen: true } })
                      setHours(u); markDirty()
                    }},
                    { label: 'Close all', fn: () => {
                      const u = { ...hours }
                      DAYS.forEach((d) => { u[d] = { ...u[d], isOpen: false } })
                      setHours(u); markDirty()
                    }},
                  ].map(({ label, fn }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={fn}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition-colors cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYOUT ──────────────────────────────────────────────────── */}
          {activeTab === 'payout' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
                <SectionHeader icon={<CreditCard size={18} />} title="Payout bank account" desc="Earnings are transferred here on a weekly basis" />

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Ensure the account belongs to the business owner. Incorrect details may delay payouts.
                    GrandXL verifies bank details before first payout.
                  </p>
                </div>

                {/* Bank name with dropdown */}
                <Field label="Bank name *">
                  <div className="relative">
                    <input
                      value={bankDetails.bankName}
                      onChange={(e) => {
                        setBankDetails((b) => ({ ...b, bankName: e.target.value }))
                        setBankFilter(e.target.value)
                        setBankDropdownOpen(true)
                        markDirty()
                      }}
                      onFocus={() => setBankDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setBankDropdownOpen(false), 150)}
                      placeholder="Search or type bank name"
                      className={inputCls}
                    />
                    {bankDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                        {NIGERIAN_BANKS.filter((b) =>
                          b.toLowerCase().includes(bankFilter.toLowerCase())
                        ).map((bank) => (
                          <button
                            key={bank}
                            type="button"
                            onMouseDown={() => {
                              setBankDetails((bd) => ({ ...bd, bankName: bank }))
                              setBankFilter(bank)
                              setBankDropdownOpen(false)
                              markDirty()
                            }}
                            className={`w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-orange-50 cursor-pointer ${
                              bankDetails.bankName === bank ? 'bg-orange-50 font-semibold text-orange-700' : 'text-gray-700'
                            }`}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Account number *" hint="10-digit NUBAN number">
                  <div className="relative">
                    <input
                      value={bankDetails.accountNumber}
                      onChange={(e) => {
                        setBankDetails((b) => ({ ...b, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))
                        markDirty()
                      }}
                      maxLength={10}
                      placeholder="0123456789"
                      inputMode="numeric"
                      className={`${inputCls} pr-24 font-mono tracking-widest`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {bankDetails.accountNumber.length === 10 && (
                        <span className="h-5 w-5 flex items-center justify-center rounded-full bg-green-100">
                          <Check size={11} className="text-green-600" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowBankNumber(!showBankNumber)}
                        className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                      >
                        {showBankNumber ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  {/* Masked preview */}
                  {bankDetails.accountNumber && !showBankNumber && (
                    <p className="mt-1 font-mono text-xs text-gray-400">
                      {'•'.repeat(Math.max(0, bankDetails.accountNumber.length - 4))}{bankDetails.accountNumber.slice(-4)}
                    </p>
                  )}
                </Field>

                <Field label="Account name *" hint="Must match the name on the bank account">
                  <input
                    value={bankDetails.accountName}
                    onChange={(e) => { setBankDetails((b) => ({ ...b, accountName: e.target.value })); markDirty() }}
                    placeholder="e.g. Oluwaseun Adebayo"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Current payout summary */}
              {bankDetails.bankName && bankDetails.accountNumber && (
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Current payout account</p>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
                      <CreditCard size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{bankDetails.bankName}</p>
                      <p className="font-mono text-sm text-gray-600 mt-0.5">
                        {'•'.repeat(6)}{bankDetails.accountNumber.slice(-4)}
                      </p>
                      {bankDetails.accountName && (
                        <p className="text-xs text-gray-400 mt-0.5">{bankDetails.accountName}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom save button (echoes the top one) */}
          <div className="mt-6 flex items-center justify-between">
            {dirty && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                You have unsaved changes
              </p>
            )}
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !form.name.trim()}
              className="ml-auto flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {updateMutation.isPending ? (
                <><Spinner size={14} /> Saving…</>
              ) : (
                <><Check size={14} /> Save changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-gray-50">
      <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}
