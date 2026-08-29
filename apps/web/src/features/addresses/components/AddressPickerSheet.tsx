import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Home, Briefcase, Plus, Navigation, Trash2, Check, X, AlertCircle, TriangleAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { Address } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAddresses, useAddAddress, useDeleteAddress } from '../hooks/useAddresses'
import { useLocationStore } from '../../../store/location.store'
import { reverseGeocode } from '../../../hooks/useDetectLocation'

interface Props {
  isOpen: boolean
  onClose: () => void
  selected: Address | null
  onSelect: (address: Address) => void
}

const LABEL_ICONS: Record<string, React.ReactNode> = {
  home:   <Home size={15} />,
  work:   <Briefcase size={15} />,
  office: <Briefcase size={15} />,
  other:  <MapPin size={15} />,
}

function labelIcon(label: string | undefined | null) {
  return LABEL_ICONS[(label ?? '').toLowerCase()] ?? <MapPin size={15} />
}

function AddressCard({
  address,
  isSelected,
  isDefault,
  onSelect,
  onDelete,
}: {
  address: Address
  isSelected: boolean
  isDefault: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('addresses')
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={`relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white hover:bg-gray-50'
      }`}
      onClick={onSelect}
      style={{ touchAction: 'manipulation' }}
    >
      <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
        {isSelected ? <Check size={15} /> : labelIcon(address.label)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 capitalize">{address.label}</p>
          {isDefault && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {t('default')}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{address.street}</p>
        <p className="text-xs text-gray-400">{address.city}, {address.state}</p>
        {!address.coordinates && (
          <p className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 font-medium">
            <TriangleAlert size={10} className="shrink-0" />
            {t('noLocationPin')}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="mt-0.5 p-1.5 rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
        aria-label={t('deleteAddress')}
        style={{ touchAction: 'manipulation' }}
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  )
}

interface AddFormState {
  label: string
  street: string
  city: string
  state: string
}

function AddAddressForm({ onSaved, onCancel }: { onSaved: (addr: Address) => void; onCancel: () => void }) {
  const { mutate: addAddress, isPending } = useAddAddress()
  const { t } = useTranslation('addresses')
  const [form, setForm] = useState<AddFormState>({ label: 'home', street: '', city: '', state: '' })
  // Never pre-populate from stale location store — only use coords the user actively requests
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsGeo, setGpsGeo] = useState<{ city: string; state: string; display: string } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsDetected, setGpsDetected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof AddFormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
  }

  function detectGPS() {
    if (!navigator.geolocation) {
      toast.error(t('gpsNotAvailable'))
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGpsCoords(coords)
        try {
          const geo = await reverseGeocode(coords.lat, coords.lng)
          if (geo) {
            setGpsGeo(geo)
            setForm((f) => ({
              ...f,
              city: f.city || geo.city,
              state: f.state || geo.state,
            }))
          } else {
            // Coordinates captured but couldn't reverse geocode — user fills city/state manually
            setGpsGeo({ city: '', state: '', display: 'GPS pinned' })
          }
        } catch {
          setGpsGeo({ city: '', state: '', display: 'GPS pinned' })
        }
        setGpsDetected(true)
        setGpsLoading(false)
      },
      () => {
        setGpsLoading(false)
        toast.error(t('gpsLocationError'))
      },
      { timeout: 8000 },
    )
  }

  function submit() {
    if (!form.street.trim()) { setError(t('streetRequired')); return }

    addAddress(
      {
        label: form.label,
        street: form.street.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: 'NG',
        ...(gpsCoords ? { coordinates: gpsCoords } : {}),
      },
      {
        onSuccess: (res) => {
          toast.success(t('addressSaved'))
          onSaved(res.data.data as Address)
        },
        onError: (err: unknown) => toast.error(parseApiError(err, t('addressSaveError'))),
      },
    )
  }

  const LABELS = ['home', 'work', 'other']

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-3 pt-3 border-t border-gray-100"
    >
      <p className="text-sm font-semibold text-gray-900">{t('newAddress')}</p>

      {/* Label selector */}
      <div className="flex gap-2">
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => set('label', l)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
              form.label === l ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {labelIcon(l)}
            <span className="capitalize">{l}</span>
          </button>
        ))}
      </div>

      {/* GPS button — shows detected location once filled */}
      <button
        type="button"
        onClick={detectGPS}
        disabled={gpsLoading}
        className={`w-full flex items-center gap-3 py-2.5 px-4 rounded-xl border text-sm font-medium cursor-pointer transition-colors disabled:opacity-60 ${
          gpsDetected
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-dashed border-primary/40 text-primary hover:bg-primary/5'
        }`}
      >
        <span className="shrink-0">
          {gpsLoading
            ? <span className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin block" />
            : gpsDetected
            ? <Check size={15} className="text-green-600" />
            : <Navigation size={15} />
          }
        </span>
        <span className="flex-1 text-left truncate">
          {gpsLoading
            ? t('detecting')
            : gpsDetected
            ? (gpsGeo?.display || t('gpsPinned'))
            : t('useCurrentLocation')
          }
        </span>
        {gpsDetected && (
          <span className="text-xs text-green-600 font-normal shrink-0">{t('tapToRefresh')}</span>
        )}
      </button>

      {/* After GPS detect: prompt user to fill in address fields */}
      {gpsDetected && (
        <p className="flex items-center gap-1.5 text-xs text-primary font-medium -mt-1">
          <Navigation size={10} className="shrink-0" />
          {gpsGeo?.city ? t('enterStreetNow') : t('enterAddressNow')}
        </p>
      )}

      {/* Fields */}
      <div>
        <input
          type="text"
          value={form.street}
          onChange={(e) => set('street', e.target.value)}
          placeholder={t('streetPlaceholder')}
          className={`w-full px-4 py-3 rounded-2xl border text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
        />
        {error && (
          <p className="flex items-center gap-1.5 mt-1.5 text-xs text-red-500">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
          placeholder={t('cityPlaceholder')}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <input
          type="text"
          value={form.state}
          onChange={(e) => set('state', e.target.value)}
          placeholder={t('statePlaceholder')}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-medium text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          {t('common:cancel')}
        </button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60"
          style={{ touchAction: 'manipulation' }}
        >
          {isPending && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {isPending ? t('saving') : t('saveAddress')}
        </motion.button>
      </div>
    </motion.div>
  )
}

export function AddressPickerSheet({ isOpen, onClose, selected, onSelect }: Props) {
  const { addresses, defaultAddressId } = useAddresses()
  const { mutate: deleteAddress } = useDeleteAddress()
  const { t } = useTranslation('addresses')
  const { coordinates, city, state: locationState, displayAddress } = useLocationStore()
  const [showAddForm, setShowAddForm] = useState(false)

  // Synthesise a temporary Address from the location store so the user can
  // select their detected location without having to type it out first.
  const locationSuggestion: Address | null = coordinates
    ? {
        _id: '__gps__',
        label: 'current location',
        street: displayAddress ?? city ?? 'Your location',
        city: city ?? 'Your location',
        state: locationState ?? 'Benue',
        country: 'NG',
        coordinates: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] },
        instructions: null,
      }
    : null

  // Only show the suggestion if it isn't already selected
  const showSuggestion = locationSuggestion !== null && selected?._id !== '__gps__'

  function handleDelete(id: string) {
    deleteAddress(id)
    toast.success(t('removed'))
  }

  function handleSaved(addr: Address) {
    setShowAddForm(false)
    onSelect(addr)
    onClose()
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
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-8 max-w-2xl mx-auto"
          >
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-200" />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-gray-900">{t('deliverTo')}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
                aria-label={t('common:close')}
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* GPS-detected location suggestion */}
            {showSuggestion && locationSuggestion && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={() => { onSelect(locationSuggestion); onClose() }}
                className="w-full flex items-center gap-3 mb-4 p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors text-left"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Navigation size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary/70 leading-none mb-0.5">{t('deliverHere')}</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{displayAddress ?? city}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('yourDetectedLocation')}</p>
                </div>
                <div className="text-xs text-primary font-semibold shrink-0">{t('useThis')}</div>
              </motion.button>
            )}

            {/* Saved addresses */}
            {addresses.length > 0 && (
              <div className="space-y-2 mb-4">
                <AnimatePresence>
                  {addresses.map((addr) => (
                    <AddressCard
                      key={addr._id}
                      address={addr}
                      isSelected={selected?._id === addr._id}
                      isDefault={addr._id === defaultAddressId}
                      onSelect={() => { onSelect(addr); onClose() }}
                      onDelete={() => handleDelete(addr._id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Add new / form */}
            <AnimatePresence mode="wait">
              {showAddForm ? (
                <AddAddressForm
                  key="form"
                  onSaved={handleSaved}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-gray-200 text-gray-500 cursor-pointer hover:border-primary hover:text-primary transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Plus size={16} />
                  </div>
                  <span className="text-sm font-medium">{t('addNewAddress')}</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
