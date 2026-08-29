'use client'

// Reusable address typeahead. Same UX as Bolt/Uber/Glovo signup: user types
// two or more characters, we hit Google Places (via our proxy) with debounce,
// show suggestions in a dropdown, and on select we call Google Places Details
// to pull structured components (street_number, route, city, state) AND the
// geometry.location coords. The parent uses `onFill` to update its form and
// (typically) seed a MapPicker so the pin lands close to the true address —
// the user still confirms visually before saving.
//
// Extracted from OnboardSlideOver so restaurant settings page + onboarding
// share one implementation. Ships as a client component because it manages
// focus, debounce, and outside-click behavior.

import { useEffect, useRef, useState } from 'react'
import { mapsApi } from '@grandxl/api-client'

export interface AddressFill {
  street: string
  city:   string
  state:  string
  lat?:   number
  lng?:   number
}

type ACSuggestion = { description: string; place_id: string }

interface Props {
  onFill:      (data: AddressFill) => void
  placeholder?: string
  className?:   string
}

export function AddressAutocomplete({ onFill, placeholder, className }: Props) {
  const [query, setQuery]         = useState('')
  const [suggestions, setSug]     = useState<ACSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [open, setOpen]           = useState(false)
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 3) { setSug([]); setOpen(false); setSearchErr(''); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchErr('')
      try {
        const res         = await mapsApi.placesAutocomplete(q)
        const suggestions = res.data.data.suggestions ?? []
        setSug(suggestions)
        setOpen(suggestions.length > 0)
      } catch {
        setSearchErr('Search failed — check connection')
        setSug([]); setOpen(false)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

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
      const res    = await mapsApi.placeDetails(s.place_id)
      const result = res.data.data.result
      const comps  = result?.address_components ?? []
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
      const loc = result?.geometry?.location
      onFill({ street, city, state, lat: loc?.lat, lng: loc?.lng })
    } catch {
      // Details lookup failed — fall back to splitting the raw description so
      // the form is at least partially populated; user can correct manually.
      const parts = s.description.split(',')
      onFill({ street: parts[0]?.trim() ?? '', city: parts[1]?.trim() ?? '', state: parts[2]?.trim() ?? '' })
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          {searching ? (
            <svg className="h-3.5 w-3.5 animate-spin text-orange-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Search address or landmark…'}
          autoComplete="off"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        />
      </div>
      {searchErr ? (
        <p className="mt-1 text-xs text-red-500">{searchErr}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Powered by Google Maps · auto-fills street, city, state · drag the map below to refine</p>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); void handleSelect(s) }}
                className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-orange-50"
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
  )
}
