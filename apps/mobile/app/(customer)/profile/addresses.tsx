import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native'
import { toast } from '../../../src/lib/toast'
import { confirm } from '../../../src/lib/confirm'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useRef } from 'react'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { usersApi } from '@grandxl/api-client'
import type { Address } from '@grandxl/types'
import { useAuthStore } from '../../../src/store/auth.store'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../src/theme'

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const LABEL_OPTIONS: { label: string; icon: IoniconsName }[] = [
  { label: 'Home',  icon: 'home-outline' },
  { label: 'Work',  icon: 'briefcase-outline' },
  { label: 'Other', icon: 'location-outline' },
]

interface AddressForm {
  label: string
  street: string
  city: string
  state: string
  instructions: string
  _lat?: number
  _lng?: number
  _locationLabel?: string
}


const EMPTY_FORM: AddressForm = { label: 'Home', street: '', city: '', state: '', instructions: '', _locationLabel: undefined }

type GeoComponent = { long_name: string; types: string[] }

// ── Reverse geocode via Google Geocoding API ────────────────────────
async function googleReverse(lat: number, lng: number): Promise<{
  city: string; state: string; displayName: string
}> {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
  )
  const data = await res.json() as {
    status: string
    results: Array<{ formatted_address: string; address_components: GeoComponent[] }>
  }
  if (data.status !== 'OK' || !data.results.length) return { city: '', state: '', displayName: '' }
  const parts = data.results[0].address_components
  const get   = (type: string) => parts.find((c) => (c.types as string[]).includes(type))?.long_name ?? ''
  return {
    city:        get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
    state:       get('administrative_area_level_1'),
    displayName: data.results[0].formatted_address,
  }
}

// ── Google Places Autocomplete (direct API, no package) ─────────────
interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}
interface PlaceDetail {
  name: string
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
  address_components: GeoComponent[]
}

async function googleAutocomplete(input: string): Promise<PlacePrediction[]> {
  if (input.trim().length < 3) return []
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_KEY}&components=country:ng&language=en`
  )
  const data = await res.json() as { status: string; predictions: PlacePrediction[] }
  return data.status === 'OK' ? data.predictions : []
}

async function googlePlaceDetail(placeId: string): Promise<PlaceDetail | null> {
  const fields = 'geometry,address_components,formatted_address,name'
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_KEY}&fields=${fields}&language=en`
  )
  const data = await res.json() as { status: string; result: PlaceDetail }
  return data.status === 'OK' ? data.result : null
}

// ── Address card ───────────────────────────────────────────────────

function AddressCard({ address, isDefault, onSetDefault, onDelete }: {
  address: Address
  isDefault: boolean
  onSetDefault: () => void
  onDelete: () => void
}) {
  return (
    <View style={[s.card, isDefault && s.cardDefault]}>
      <View style={s.cardLeft}>
        <View style={s.cardLabelRow}>
          <Ionicons name="location" size={14} color={COLORS.primary} />
          <Text style={s.cardLabel}>{address.label}</Text>
          {isDefault && (
            <View style={s.defaultBadge}>
              <Text style={s.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <Text style={s.cardStreet}>{address.street}</Text>
        <Text style={s.cardCity}>{address.city}, {address.state}</Text>
        {address.instructions ? (
          <Text style={s.cardInstructions}>{address.instructions}</Text>
        ) : null}
      </View>
      <View style={s.cardActions}>
        {!isDefault && (
          <Pressable style={s.actionBtn} onPress={onSetDefault} hitSlop={8}>
            <Text style={s.actionBtnText}>Set default</Text>
          </Pressable>
        )}
        <Pressable style={[s.actionBtn, s.actionBtnDelete]} onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={14} color={COLORS.error} />
        </Pressable>
      </View>
    </View>
  )
}

// ── Add address modal ──────────────────────────────────────────────

function AddAddressModal({ visible, onClose, onSave, isSaving }: {
  visible: boolean
  onClose: () => void
  onSave: (form: Required<AddressForm>) => void
  isSaving: boolean
}) {
  const [form, setForm]               = useState<AddressForm>(EMPTY_FORM)
  const [locating, setLocating]       = useState(false)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [searching, setSearching]     = useState(false)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback(<K extends keyof AddressForm>(key: K, val: AddressForm[K]) => {
    setForm((f) => ({ ...f, [key]: val }))
  }, [])

  // ── "Use my current location" ──────────────────────────────────
  const handleDetectLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        toast.warning('Location access needed to detect your address.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const { lat: latitude, lng: longitude } = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }
      const geo = await googleReverse(latitude, longitude)
      const cityFound  = geo.city  || 'your area'
      const stateFound = geo.state || ''
      const locationLabel = stateFound ? `${cityFound}, ${stateFound}` : cityFound
      setForm((f) => ({
        ...f,
        city:           geo.city  || f.city,
        state:          geo.state || f.state,
        _lat:           latitude,
        _lng:           longitude,
        _locationLabel: locationLabel,
      }))
    } catch {
      toast.error('Couldn\'t detect location. Type your address below.')
    } finally {
      setLocating(false)
    }
  }

  const handleSave = () => {
    if (!form.street.trim() || !form.city.trim() || !form.state.trim()) {
      toast.warning('Please fill in street, city, and state.')
      return
    }
    onSave({ ...form, _lat: form._lat ?? 6.5244, _lng: form._lng ?? 3.3792 } as Required<AddressForm>)
    setForm(EMPTY_FORM)
    setPredictions([])
  }

  const handleStreetChange = (text: string) => {
    update('street', text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (text.length < 3) { setPredictions([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setPredictions(await googleAutocomplete(text)) }
      catch { setPredictions([]) }
      finally { setSearching(false) }
    }, 400)
  }

  const handleSelectPrediction = async (p: PlacePrediction) => {
    setPredictions([])
    update('street', p.structured_formatting.main_text)
    const detail = await googlePlaceDetail(p.place_id)
    if (!detail) return
    const parts = detail.address_components
    const get   = (type: string) => parts.find((c) => (c.types as string[]).includes(type))?.long_name ?? ''
    const city  = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2')
    const state = get('administrative_area_level_1')
    setForm((f) => ({
      ...f,
      street:         p.structured_formatting.main_text,
      city:           city  || f.city,
      state:          state || f.state,
      _lat:           detail.geometry.location.lat,
      _lng:           detail.geometry.location.lng,
      _locationLabel: detail.formatted_address,
    }))
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={s.modalSafe}>

          {/* Header */}
          <View style={s.modalHeader}>
            <Pressable onPress={onClose} style={s.modalCancel}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>
            <Text style={s.modalTitle}>Add Address</Text>
            <Pressable onPress={handleSave} style={s.modalSaveBtn} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={s.modalSaveText}>Save</Text>
              }
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">

            {/* Label */}
            <Text style={s.fieldLabel}>Label</Text>
            <View style={s.labelRow}>
              {LABEL_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  style={[s.labelChip, form.label === opt.label && s.labelChipActive]}
                  onPress={() => update('label', opt.label)}
                >
                  <Ionicons name={opt.icon} size={14} color={form.label === opt.label ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[s.labelChipText, form.label === opt.label && s.labelChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Detect location button */}
            <Pressable style={s.detectBtn} onPress={handleDetectLocation} disabled={locating}>
              {locating
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name="navigate" size={16} color={COLORS.primary} />
              }
              <Text style={s.detectBtnText}>
                {locating ? 'Detecting your location…' : 'Use my current location'}
              </Text>
            </Pressable>

            {/* Street address — Google Places Autocomplete (direct API) */}
            <Text style={s.fieldLabel}>Street address</Text>
            <View style={s.autocompleteWrap}>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={form.street}
                  onChangeText={handleStreetChange}
                  placeholder="e.g. 12 Ahmadu Bello Way, Wuse 2"
                  placeholderTextColor={COLORS.textTertiary}
                  returnKeyType="next"
                  autoCorrect={false}
                />
                {searching && (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ position: 'absolute', right: 12 }} />
                )}
              </View>
              {predictions.length > 0 && (
                <View style={s.placesList}>
                  {predictions.map((p) => (
                    <Pressable key={p.place_id} style={s.placesRow} onPress={() => handleSelectPrediction(p)}>
                      <Ionicons name="location-outline" size={14} color={COLORS.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.placesMain} numberOfLines={1}>{p.structured_formatting.main_text}</Text>
                        <Text style={s.placesSub} numberOfLines={1}>{p.structured_formatting.secondary_text}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* City */}
            <Text style={s.fieldLabel}>City</Text>
            <TextInput
              style={s.input}
              value={form.city}
              onChangeText={(v) => update('city', v)}
              placeholder="Lagos"
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="next"
            />

            {/* State */}
            <Text style={s.fieldLabel}>State</Text>
            <TextInput
              style={s.input}
              value={form.state}
              onChangeText={(v) => update('state', v)}
              placeholder="Lagos State"
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="next"
            />

            {/* Instructions */}
            <Text style={s.fieldLabel}>Delivery instructions (optional)</Text>
            <TextInput
              style={[s.input, s.inputMultiline]}
              value={form.instructions}
              onChangeText={(v) => update('instructions', v)}
              placeholder="Gate code, landmark, floor number…"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={3}
            />

            {/* Location confirmation — shows detected area, prompts user to add street */}
            {form._lat != null && (
              <View style={s.coordsCard}>
                <View style={s.coordsRow}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={s.coordsText}>
                    Area detected: <Text style={s.coordsBold}>{form._locationLabel}</Text>
                  </Text>
                </View>
                {!form.street.trim() && (
                  <Text style={s.coordsHint}>Now enter your street address above</Text>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main screen ────────────────────────────────────────────────────

export default function AddressesScreen() {
  const router = useRouter()
  const qc     = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const { isAuthenticated } = useAuthStore()

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  () => usersApi.getProfile().then((r) => r.data.data),
    enabled:  isAuthenticated,
  })

  const addresses = profileData?.addresses ?? []
  const defaultId = profileData?.defaultAddressId ?? null

  const addMutation = useMutation({
    mutationFn: (form: Required<AddressForm>) =>
      usersApi.addAddress({
        label:        form.label,
        street:       form.street.trim(),
        city:         form.city.trim(),
        state:        form.state.trim(),
        country:      'NG',
        coordinates:  { lat: form._lat, lng: form._lng },
        instructions: form.instructions.trim() || undefined,
      }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      setModalVisible(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const defaultMutation = useMutation({
    mutationFn: (id: string) => usersApi.setDefaultAddress(id).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError:    (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError:    (err: Error) => toast.error(err.message),
  })

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title:        'Remove address?',
      message:      'This address will be deleted permanently.',
      confirmLabel: 'Remove',
      variant:      'destructive',
      icon:         'trash',
    })
    if (ok) deleteMutation.mutate(id)
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Saved Addresses</Text>
        <Pressable style={s.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color={COLORS.primary} />
        </Pressable>
      </View>

      {!isAuthenticated ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={s.emptyTitle}>Sign in to save addresses</Text>
          <Text style={s.emptySubtitle}>Your saved addresses make checkout faster. Log in to manage them.</Text>
          <Pressable style={s.emptyBtn} onPress={() => router.push('/(auth)/login' as never)}>
            <Text style={s.emptyBtnText}>Sign In</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="location-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={s.emptyTitle}>No addresses saved</Text>
          <Text style={s.emptySubtitle}>Add a delivery address to make checkout faster.</Text>
          <Pressable style={s.emptyBtn} onPress={() => setModalVisible(true)}>
            <Text style={s.emptyBtnText}>Add Address</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              isDefault={item._id === defaultId}
              onSetDefault={() => defaultMutation.mutate(item._id)}
              onDelete={() => handleDelete(item._id)}
            />
          )}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListFooterComponent={
            <Pressable style={s.addNewBtn} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={s.addNewBtnText}>Add new address</Text>
            </Pressable>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddAddressModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={(form) => addMutation.mutate(form)}
        isSaving={addMutation.isPending}
      />
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  addBtn:      { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },

  listContent: { padding: SPACING.lg },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  cardDefault:  { borderColor: COLORS.primary },
  cardLeft:     { flex: 1, gap: 3 },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  cardLabel:    { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  defaultBadge: { backgroundColor: COLORS.primaryFade, borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  defaultBadgeText: { fontSize: FONT.xs, fontFamily: FONTS.semibold, color: COLORS.primary },
  cardStreet:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  cardCity:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  cardInstructions: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, fontStyle: 'italic' },
  cardActions:  { gap: SPACING.sm, alignItems: 'flex-end', justifyContent: 'flex-start' },
  actionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionBtnDelete: { borderColor: COLORS.error, paddingHorizontal: 6 },
  actionBtnText:   { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.primary },

  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  addNewBtnText: { fontSize: FONT.md, fontFamily: FONTS.medium, color: COLORS.primary },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle:    { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  emptyBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },

  // Modal
  modalSafe:   { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel:     { width: 60 },
  modalCancelText: { fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  modalTitle:      { fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  modalSaveBtn:    { width: 60, alignItems: 'flex-end' },
  modalSaveText:   { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.primary },
  modalBody:       { padding: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.xxxl },

  // Form
  fieldLabel: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginTop: SPACING.md, marginBottom: 4 },
  labelRow:   { flexDirection: 'row', gap: SPACING.sm },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  labelChipActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  labelChipText:       { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  labelChipTextActive: { color: COLORS.primary },

  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primaryFade,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  detectBtnText: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary },

  input: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : SPACING.sm,
    fontSize: FONT.md,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  autocompleteWrap: { zIndex: 10 },
  inputRow: { position: 'relative', justifyContent: 'center' },
  placesList: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: 4,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  placesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placesMain: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  placesSub:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 1 },

  // Location detected confirmation card
  coordsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coordsText:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.success },
  coordsBold:  { fontFamily: FONTS.semibold },
  coordsHint:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginLeft: 22 },
})
