import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, StatusBar,
} from 'react-native'
import { toast } from '../../src/lib/toast'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { ridersApi, authApi } from '@grandxl/api-client'
import { VehicleType } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH } from '../../src/lib/axios'
import { COLORS, SPACING, RADIUS, FONT, FONTS } from '../../src/theme'

const VEHICLES: { type: VehicleType; label: string; icon: string; sub: string }[] = [
  { type: VehicleType.MOTORCYCLE, label: 'Motorcycle',  icon: '🏍️', sub: 'Most popular — fastest earnings' },
  { type: VehicleType.BICYCLE,    label: 'Bicycle',     icon: '🚲', sub: 'Great for short distances'         },
  { type: VehicleType.CAR,        label: 'Car',         icon: '🚗', sub: 'For larger orders'                 },
]

export default function RiderSetupScreen() {
  const router   = useRouter()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const { isAuthenticated } = useAuthStore()
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null)
  const [plate, setPlate]             = useState('')
  const [focused, setFocused]         = useState(false)

  // If rider profile already exists, skip straight to pending — don't re-register
  const { data: existingRider } = useQuery({
    queryKey: ['riderProfile'],
    queryFn:  () => ridersApi.getProfile().then((r) => r.data.data),
    enabled:  isAuthenticated,
    retry:    false,
  })
  useEffect(() => {
    if (existingRider) {
      router.replace('/(rider-onboarding)/pending')
    }
  }, [existingRider])

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // 1. Create rider profile (also upgrades user role to RIDER server-side)
      await ridersApi.registerRider({
        vehicleType: vehicleType!,
        ...(plate.trim() ? { vehiclePlate: plate.trim().toUpperCase() } : {}),
      })
      // 2. Refresh the JWT so it now carries role:rider
      //    — subsequent RIDER-only endpoints (documents, profile) will pass the roles guard
      const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH)
      if (refreshToken) {
        const res = await authApi.refreshMobile({ refreshToken })
        const { accessToken, refreshToken: newRefresh, user } = res.data.data
        await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
        if (newRefresh) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, newRefresh)
        setAuth(user, accessToken)
      }
    },
    onSuccess: () => router.replace('/(rider-onboarding)/documents'),
    onError:   (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        // Profile already exists — skip registration, go to pending
        router.replace('/(rider-onboarding)/pending')
        return
      }
      toast.error('Could not save vehicle info. Please try again.')
    },
  })

  function handleNext() {
    if (!vehicleType) {
      toast.warning('Please choose your vehicle type to continue.')
      return
    }
    mutate()
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.step}>Step 1 of 3</Text>
          <View style={s.progressRow}>
            <View style={[s.progressBar, s.progressActive]} />
            <View style={s.progressBar} />
            <View style={s.progressBar} />
          </View>
          <Text style={s.title}>Your vehicle</Text>
          <Text style={s.sub}>Tell us how you'll make deliveries</Text>
        </View>

        {/* Vehicle picker */}
        <View style={s.section}>
          <Text style={s.label}>Vehicle type</Text>
          <View style={s.vehicleGrid}>
            {VEHICLES.map((v) => (
              <TouchableOpacity
                key={v.type}
                style={[s.vehicleCard, vehicleType === v.type && s.vehicleCardActive]}
                onPress={() => setVehicleType(v.type)}
                activeOpacity={0.8}
              >
                <Text style={s.vehicleIcon}>{v.icon}</Text>
                <Text style={[s.vehicleLabel, vehicleType === v.type && s.vehicleLabelActive]}>{v.label}</Text>
                <Text style={s.vehicleSub}>{v.sub}</Text>
                {vehicleType === v.type && (
                  <View style={s.checkBadge}>
                    <Text style={s.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Plate */}
        <View style={s.section}>
          <Text style={s.label}>Vehicle plate number <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={[s.input, focused && s.inputFocused]}
            value={plate}
            onChangeText={setPlate}
            placeholder="e.g. LND-123XY"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="characters"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <Text style={s.hint}>You can add or update this later from your profile.</Text>
        </View>

        <TouchableOpacity
          style={[s.btn, (!vehicleType || isPending) && s.btnDisabled]}
          onPress={handleNext}
          disabled={!vehicleType || isPending}
          activeOpacity={0.85}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Continue</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, paddingHorizontal: SPACING.xxl, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl },

  header:       { marginBottom: SPACING.xxxl },
  step:         { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary, marginBottom: SPACING.sm },
  progressRow:  { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.xxl },
  progressBar:  { flex: 1, height: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.border },
  progressActive: { backgroundColor: COLORS.primary },
  title:        { fontSize: FONT.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  sub:          { fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  section:   { marginBottom: SPACING.xxl },
  label:     { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  optional:  { fontFamily: FONTS.regular, color: COLORS.textTertiary },

  vehicleGrid:       { gap: SPACING.md },
  vehicleCard: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    padding: SPACING.lg, backgroundColor: COLORS.surface, position: 'relative',
  },
  vehicleCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  vehicleIcon:       { fontSize: 28, marginBottom: SPACING.xs },
  vehicleLabel:      { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 2 },
  vehicleLabelActive: { color: COLORS.primary },
  vehicleSub:        { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  checkBadge: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    width: 22, height: 22, borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 12, fontFamily: FONTS.bold },

  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textPrimary,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  hint:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: SPACING.xs },

  btn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, alignItems: 'center', minHeight: 52 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontFamily: FONTS.bold, fontSize: FONT.md },
})
