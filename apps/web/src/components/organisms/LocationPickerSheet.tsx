import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Navigation, Search, X, Check, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocationStore } from '../../store/location.store'
import { reverseGeocode } from '../../hooks/useDetectLocation'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

async function fetchPredictions(input: string): Promise<PlacePrediction[]> {
  if (!input.trim()) return []
  const params = new URLSearchParams({
    input,
    components: 'country:ng',
    types: 'geocode',
    language: 'en',
    key: GOOGLE_KEY,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
  )
  const data = await res.json() as { predictions: PlacePrediction[]; status: string }
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return []
  return data.predictions ?? []
}

async function placeDetails(placeId: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_KEY}`,
  )
  const data = await res.json() as {
    result?: { geometry?: { location?: { lat: number; lng: number } } }
  }
  return data.result?.geometry?.location ?? null
}

export function LocationPickerSheet({ isOpen, onClose }: Props) {
  const { city, displayAddress, setLocation } = useLocationStore()
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [gpsLoading, setGpsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350)
    } else {
      setQuery('')
      setPredictions([])
      setSelected(null)
    }
  }, [isOpen])

  // Debounced Places search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setPredictions([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await fetchPredictions(query)
        setPredictions(results)
      } catch {
        setPredictions([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)
  }, [query])

  async function handleGPS() {
    if (!navigator.geolocation) {
      toast.error('GPS not available on this browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const geo = await reverseGeocode(latitude, longitude)
          if (geo) {
            setLocation({ lat: latitude, lng: longitude }, geo.city, geo.display, 'gps', geo.state)
            toast.success(`Location set to ${geo.city}`)
          } else {
            setLocation({ lat: latitude, lng: longitude }, 'Your location', 'Location detected', 'gps', 'Benue')
            toast.success('Location detected')
          }
          onClose()
        } catch {
          toast.error('Could not resolve location. Try searching manually.')
        } finally {
          setGpsLoading(false)
        }
      },
      () => {
        setGpsLoading(false)
        toast.error('Location access denied. Please allow location in browser settings.')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  async function handleSelectPrediction(pred: PlacePrediction) {
    setSelected(pred.place_id)
    try {
      const coords = await placeDetails(pred.place_id)
      const cityName = pred.structured_formatting.main_text
      const display = pred.description
      setLocation(
        coords ?? { lat: 0, lng: 0 },
        cityName,
        display,
        'manual',
      )
      toast.success(`Delivery area set to ${cityName}`)
      onClose()
    } catch {
      toast.error('Could not load location details. Try again.')
    } finally {
      setSelected(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] rounded-t-3xl bg-white px-4 pt-3 pb-8 max-w-2xl mx-auto flex flex-col"
          >
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-200 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="font-display font-bold text-lg text-gray-900">Set your location</h2>
                <p className="text-xs text-gray-400 mt-0.5">So we can show restaurants near you</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Current location pill */}
            {city && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-2xl shrink-0"
              >
                <MapPin size={14} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-primary/70 leading-none">Current area</p>
                  <p className="text-sm font-semibold text-primary truncate">{displayAddress ?? city}</p>
                </div>
                <Check size={14} className="text-primary shrink-0" />
              </motion.div>
            )}

            {/* GPS button */}
            <button
              type="button"
              onClick={handleGPS}
              disabled={gpsLoading}
              className="w-full flex items-center gap-3 px-4 py-3.5 mb-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60 shrink-0"
              style={{ touchAction: 'manipulation' }}
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {gpsLoading
                  ? <Loader size={17} className="animate-spin" />
                  : <Navigation size={17} />
                }
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">
                  {gpsLoading ? 'Detecting your location…' : 'Use my current location'}
                </p>
                <p className="text-xs text-primary/60">GPS auto-detect</p>
              </div>
            </button>

            {/* Search */}
            <div className="relative mb-3 shrink-0">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city or neighbourhood…"
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchLoading && (
                <Loader size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Predictions */}
            <div className="overflow-y-auto flex-1">
              <AnimatePresence>
                {predictions.map((pred, i) => (
                  <motion.button
                    key={pred.place_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.15 }}
                    type="button"
                    onClick={() => void handleSelectPrediction(pred)}
                    disabled={selected === pred.place_id}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-60"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      {selected === pred.place_id
                        ? <Loader size={15} className="animate-spin text-primary" />
                        : <MapPin size={15} className="text-gray-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {pred.structured_formatting.main_text}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {pred.structured_formatting.secondary_text}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>

              {/* Empty state */}
              {query.length > 1 && !searchLoading && predictions.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-gray-400 py-8"
                >
                  No results for &ldquo;{query}&rdquo;
                </motion.p>
              )}

              {/* Popular cities */}
              {!query && predictions.length === 0 && (
                <div className="pt-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Cities in Benue</p>
                  {[
                    { name: 'Makurdi', lat: 7.7322, lng: 8.5391 },
                    { name: 'Gboko', lat: 7.3267, lng: 8.9961 },
                    { name: 'Otukpo', lat: 7.1833, lng: 8.1333 },
                    { name: 'Katsina-Ala', lat: 7.1667, lng: 9.2833 },
                    { name: 'Vandekya', lat: 6.9167, lng: 9.0667 },
                  ].map(({ name, lat, lng }, i) => (
                    <motion.button
                      key={name}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.15 }}
                      type="button"
                      onClick={() => {
                        setLocation({ lat, lng }, name, `${name}, Benue`, 'manual')
                        toast.success(`Delivery area set to ${name}`)
                        onClose()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <MapPin size={15} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400">Benue State</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
