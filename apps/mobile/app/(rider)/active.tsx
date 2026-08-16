import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  Linking,
  AppState,
} from 'react-native'
import { confirm } from '../../src/lib/confirm'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useEffect, useState } from 'react'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi, ridersApi, restaurantsApi } from '@grandxl/api-client'
import { OrderStatus } from '@grandxl/types'
import { socket } from '../../src/lib/socket'
import { Skeleton } from '../../src/components/atoms/Skeleton'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Delivery stage config ─────────────────────────────────────────────────────
type Stage = 0 | 1 | 2   // 0=waiting, 1=pickup, 2=deliver

const STATUS_STAGE: Partial<Record<OrderStatus, Stage>> = {
  [OrderStatus.CONFIRMED]: 0,
  [OrderStatus.PREPARING]: 0,
  [OrderStatus.READY]:     1,
  [OrderStatus.PICKED_UP]: 2,
  [OrderStatus.DELIVERED]: 2,
}

const STEPS = [
  { label: 'Waiting',  icon: 'time-outline'    as const },
  { label: 'Pick up',  icon: 'bag-handle'       as const },
  { label: 'Deliver',  icon: 'checkmark-circle' as const },
]

// What to show inside the instruction banner per status
const INSTRUCTION: Partial<Record<OrderStatus, {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  color: string
  waiting: boolean
}>> = {
  [OrderStatus.CONFIRMED]: {
    icon: 'time-outline', title: 'Order confirmed',
    body: 'The restaurant is confirming your order. Hang tight.',
    color: COLORS.warning, waiting: true,
  },
  [OrderStatus.PREPARING]: {
    icon: 'restaurant', title: 'Restaurant is preparing',
    body: 'Food is being prepared. Head to the restaurant soon.',
    color: COLORS.primary, waiting: true,
  },
  [OrderStatus.READY]: {
    icon: 'bag-handle', title: 'Food is ready — go pick it up!',
    body: 'The restaurant has packed the order. Proceed to pick up.',
    color: COLORS.primary, waiting: false,
  },
  [OrderStatus.PICKED_UP]: {
    icon: 'navigate', title: 'Head to the drop-off point',
    body: "You've picked up the order. Deliver it to the customer.",
    color: COLORS.success, waiting: false,
  },
}

const RIDER_ACTIONS: Partial<Record<OrderStatus, { status: OrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }>> = {
  [OrderStatus.READY]:     { status: OrderStatus.PICKED_UP, label: 'Confirm Pickup',   icon: 'bag-handle',    color: COLORS.primary },
  [OrderStatus.PICKED_UP]: { status: OrderStatus.DELIVERED, label: 'Confirm Delivery', icon: 'checkmark-done', color: COLORS.success },
}

// ── Progress stepper ──────────────────────────────────────────────────────────
function Stepper({ stage }: { stage: Stage }) {
  return (
    <View style={p.row}>
      {STEPS.map((step, idx) => {
        const done    = idx < stage
        const active  = idx === stage
        const future  = idx > stage
        return (
          <View key={step.label} style={p.stepWrap}>
            {/* Connector before */}
            {idx > 0 && (
              <View style={[p.connector, done && p.connectorDone]} />
            )}
            {/* Circle */}
            <View style={[
              p.circle,
              active && p.circleActive,
              done   && p.circleDone,
              future && p.circleFuture,
            ]}>
              {done
                ? <Ionicons name="checkmark" size={13} color="#fff" />
                : <Ionicons name={step.icon} size={13} color={active ? '#fff' : COLORS.textTertiary} />
              }
            </View>
            {/* Label */}
            <Text style={[p.label, active && p.labelActive, done && p.labelDone]}>
              {step.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ActiveDeliveryScreen() {
  const qc     = useQueryClient()
  const mapRef = useRef<MapView>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null)

  const { data: activeOrder, isLoading, refetch } = useQuery({
    queryKey: ['riderActiveOrder'],
    queryFn:  () => ridersApi.getActiveJob().then((r) => r.data.data ?? null),
    refetchInterval: 10_000,
    staleTime: 0,
  })

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void qc.invalidateQueries({ queryKey: ['riderActiveOrder'] })
    })
    return () => sub.remove()
  }, [qc])

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant', activeOrder?._id ? activeOrder.restaurantId : null],
    queryFn: () => restaurantsApi.getById(activeOrder!.restaurantId).then((r) => r.data.data),
    enabled: !!activeOrder?.restaurantId,
    staleTime: 300_000,
  })

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeOrder) return
    const orderId = activeOrder._id
    const interval = setInterval(async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        const { latitude, longitude, heading } = pos.coords
        setCurrentCoords({ lat: latitude, lng: longitude })
        socket.emit('rider:location_update', { lat: latitude, lng: longitude, bearing: heading ?? 0, orderId })
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [activeOrder?._id])

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      ordersApi.updateStatus(orderId, { status }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riderActiveOrder'] })
      qc.invalidateQueries({ queryKey: ['riderJobs'] })
    },
    onError: (err: Error) => { void confirm({ title: 'Couldn\'t update order', message: err.message, mode: 'alert', icon: 'warning', variant: 'destructive' }) },
  })

  const deliveryCoords = activeOrder?.deliveryAddress.coordinates
    ? {
        lat: activeOrder.deliveryAddress.coordinates.coordinates[1],
        lng: activeOrder.deliveryAddress.coordinates.coordinates[0],
      }
    : null

  const restaurantCoords = restaurant?.address?.coordinates
    ? {
        lat: restaurant.address.coordinates.coordinates[1],
        lng: restaurant.address.coordinates.coordinates[0],
      }
    : null

  const isPrePickup = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(
    (activeOrder?.status ?? '') as OrderStatus
  )
  const destinationCoords = isPrePickup ? restaurantCoords : deliveryCoords
  const destinationLabel  = isPrePickup ? 'Restaurant pickup' : 'Drop-off point'

  useEffect(() => {
    if (!mapRef.current || !destinationCoords) return
    mapRef.current.fitToCoordinates(
      [destinationCoords, ...(currentCoords ? [currentCoords] : [])].map((c) => ({
        latitude: c.lat, longitude: c.lng,
      })),
      { edgePadding: { top: 80, right: 40, bottom: 320, left: 40 }, animated: true },
    )
  }, [destinationCoords?.lat, destinationCoords?.lng, currentCoords?.lat, currentCoords?.lng])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#E5E5EA' }} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={{ gap: SPACING.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: SPACING.sm }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                  <Skeleton width={32} height={32} borderRadius={16} />
                  <Skeleton width={44} height={8} borderRadius={4} />
                </View>
              ))}
            </View>
            <Skeleton width="100%" height={88} borderRadius={RADIUS.lg} />
            <Skeleton width="100%" height={64} borderRadius={RADIUS.md} />
            <Skeleton width="100%" height={52} borderRadius={RADIUS.full} />
          </View>
        </View>
      </View>
    )
  }

  // ── No active order ────────────────────────────────────────────────────────
  if (!activeOrder) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.appBar}>
          <Text style={s.appBarTitle}>Active Delivery</Text>
        </View>
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="bicycle-outline" size={40} color={COLORS.textTertiary} />
          </View>
          <Text style={s.emptyTitle}>No active delivery</Text>
          <Text style={s.emptyBody}>Accept a job from the Jobs tab to get started.</Text>
          <Pressable style={s.refreshBtn} onPress={() => void refetch()}>
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
            <Text style={s.refreshBtnText}>Refresh</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const status      = activeOrder.status as OrderStatus
  const stage       = STATUS_STAGE[status] ?? 0
  const instruction = INSTRUCTION[status]
  const nextAction  = RIDER_ACTIONS[status]
  const itemCount   = activeOrder.items.reduce((acc, i) => acc + i.quantity, 0)

  const mapCenter = destinationCoords ?? deliveryCoords
  const initialRegion = mapCenter
    ? { latitude: mapCenter.lat, longitude: mapCenter.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.05, longitudeDelta: 0.05 }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        // Google Maps on both platforms. Apple Maps on iOS has poor coverage in
        // Nigeria (no labels/streets) — Google Maps gives a consistent UX.
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onMapReady={() => {
          // eslint-disable-next-line no-console
          console.log('[MapView] onMapReady fired — native module mounted', {
            platform: Platform.OS,
            provider: Platform.OS === 'android' ? 'google' : 'default',
            initialRegion,
          })
        }}
        onMapLoaded={() => {
          // eslint-disable-next-line no-console
          console.log('[MapView] onMapLoaded fired — tiles rendered successfully')
        }}
      >
        {destinationCoords && (
          <Marker
            coordinate={{ latitude: destinationCoords.lat, longitude: destinationCoords.lng }}
            title={destinationLabel}
            pinColor={COLORS.primary}
          />
        )}
        {currentCoords && destinationCoords && (
          <Polyline
            coordinates={[
              { latitude: currentCoords.lat,     longitude: currentCoords.lng },
              { latitude: destinationCoords.lat, longitude: destinationCoords.lng },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
      </MapView>

      {/* ── Top pill ───────────────────────────────────────────────────────── */}
      <SafeAreaView style={s.mapTopBar} pointerEvents="box-none">
        <View style={s.topPill}>
          <Text style={s.topPillOrder}>{activeOrder.orderNumber}</Text>
          <View style={s.topPillDivider} />
          <Text style={s.topPillStatus}>{status.replace(/_/g, ' ')}</Text>
        </View>
      </SafeAreaView>

      {/* ── Bottom sheet ───────────────────────────────────────────────────── */}
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        {/* Progress stepper */}
        <Stepper stage={stage as Stage} />

        {/* Instruction banner */}
        {instruction && (
          <View style={[s.instructionCard, { borderLeftColor: instruction.color }]}>
            <View style={[s.instructionIconWrap, { backgroundColor: instruction.color + '18' }]}>
              <Ionicons name={instruction.icon} size={20} color={instruction.color} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.instructionTitle}>{instruction.title}</Text>
              <Text style={s.instructionBody}>{instruction.body}</Text>
            </View>
            {instruction.waiting && (
              <ActivityIndicator size="small" color={instruction.color} />
            )}
          </View>
        )}

        {/* Order + earnings summary row */}
        <View style={s.summaryRow}>
          <View style={s.summaryLeft}>
            <View style={[s.summaryIcon, { backgroundColor: COLORS.primaryFade }]}>
              <Ionicons name="restaurant" size={14} color={COLORS.primary} />
            </View>
            <View>
              <Text style={s.summaryValue}>
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </Text>
              <Text style={s.summaryMeta}>{formatMoney(activeOrder.pricing.total)} total</Text>
            </View>
          </View>

          <View style={s.earningsPill}>
            <Ionicons name="wallet" size={14} color={COLORS.success} />
            <Text style={s.earningsText}>{formatMoney(activeOrder.pricing.deliveryFee)}</Text>
          </View>
        </View>

        {/* Drop-off address */}
        <View style={s.addressRow}>
          <View style={s.addressDot} />
          <Text style={s.addressText} numberOfLines={2}>
            {activeOrder.deliveryAddress.street}, {activeOrder.deliveryAddress.city}
          </Text>
        </View>

        {/* Navigate button — prefers Google Maps (best Nigeria coverage),
            falls back to platform-native maps, then web. */}
        {destinationCoords && (
          <Pressable
            style={s.navigateBtn}
            onPress={async () => {
              const { lat, lng } = destinationCoords

              // Try Google Maps app first (best coverage in Nigeria).
              const googleAppUrl = Platform.OS === 'ios'
                ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
                : `google.navigation:q=${lat},${lng}`

              try {
                const canOpen = await Linking.canOpenURL(googleAppUrl)
                if (canOpen) {
                  await Linking.openURL(googleAppUrl)
                  return
                }
              } catch {
                // ignore — fall through to platform native
              }

              // Fall back to platform-native maps app.
              const nativeUrl = Platform.OS === 'ios'
                ? `maps://?daddr=${lat},${lng}&dirflg=d`
                : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(destinationLabel)})`

              try {
                await Linking.openURL(nativeUrl)
              } catch {
                // Last resort — web. Google Maps URL works everywhere.
                await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`)
              }
            }}
          >
            <Ionicons name="navigate-circle" size={18} color={COLORS.primary} />
            <Text style={s.navigateBtnText}>Navigate</Text>
          </Pressable>
        )}

        {/* Action button */}
        {nextAction ? (
          <Pressable
            style={[s.actionBtn, { backgroundColor: nextAction.color }, updateMutation.isPending && { opacity: 0.65 }]}
            disabled={updateMutation.isPending}
            onPress={async () => {
              const ok = await confirm({
                title:        nextAction.label,
                message:      'Are you sure you want to proceed?',
                confirmLabel: nextAction.label,
                icon:         'check',
              })
              if (ok) updateMutation.mutate({ orderId: activeOrder._id, status: nextAction.status })
            }}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name={nextAction.icon} size={20} color="#fff" />
                <Text style={s.actionBtnText}>{nextAction.label}</Text>
              </>
            )}
          </Pressable>
        ) : (
          // Waiting state — no button, just breathing room
          <View style={s.waitingPlaceholder} />
        )}
      </View>
    </View>
  )
}

// ── Stepper styles ────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'center',
    marginBottom:   SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  stepWrap: {
    flex:       1,
    alignItems: 'center',
    gap:        5,
    position:   'relative',
  },
  connector: {
    position:        'absolute',
    top:             15,
    right:           '50%',
    left:            '-50%',
    height:          2,
    backgroundColor: COLORS.border,
    zIndex:          0,
  },
  connectorDone: { backgroundColor: COLORS.primary },

  circle: {
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          1,
  },
  circleActive:  { backgroundColor: COLORS.primary },
  circleDone:    { backgroundColor: COLORS.primary },
  circleFuture:  { backgroundColor: COLORS.surfaceHighlight, borderWidth: 1.5, borderColor: COLORS.border },

  label:       { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.textTertiary, textAlign: 'center' },
  labelActive: { color: COLORS.primary, fontFamily: FONTS.semibold },
  labelDone:   { color: COLORS.primary },
})

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: COLORS.surfaceHighlight,
    paddingTop:      Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  appBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor:   COLORS.bg,
  },
  appBarTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  emptyState: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrap: {
    width:           80,
    height:          80,
    borderRadius:    24,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody:  { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  refreshBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.xs,
    borderRadius:      RADIUS.full,
    borderWidth:       1.5,
    borderColor:       COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.sm,
    marginTop:         SPACING.sm,
  },
  refreshBtnText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  // Top pill
  mapTopBar: {
    position:   'absolute',
    top:        0,
    left:       0,
    right:      0,
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + SPACING.sm : SPACING.lg,
  },
  topPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    backgroundColor:   COLORS.bg,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical:   10,
    ...SHADOW.md,
  },
  topPillOrder:   { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  topPillDivider: { width: 1, height: 14, backgroundColor: COLORS.border },
  topPillStatus:  {
    fontSize:      FONT.xs,
    fontFamily:    FONTS.semibold,
    color:         COLORS.primary,
    textTransform: 'capitalize',
  },

  // Bottom sheet
  sheet: {
    position:             'absolute',
    bottom:               0,
    left:                 0,
    right:                0,
    backgroundColor:      COLORS.bg,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal:    SPACING.lg,
    paddingBottom:        Platform.OS === 'ios' ? 34 : SPACING.xl,
    paddingTop:           SPACING.md,
    ...SHADOW.md,
  },
  sheetHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: COLORS.border,
    alignSelf:       'center',
    marginBottom:    SPACING.lg,
  },

  // Instruction card
  instructionCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.md,
    borderRadius:    RADIUS.lg,
    borderLeftWidth: 4,
    backgroundColor: COLORS.surfaceHighlight,
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
  },
  instructionIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  instructionTitle: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  instructionBody:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 16 },

  // Summary row
  summaryRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.sm,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  summaryIcon: {
    width:           32,
    height:          32,
    borderRadius:    9,
    alignItems:      'center',
    justifyContent:  'center',
  },
  summaryValue: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  summaryMeta:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  earningsPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    backgroundColor:   COLORS.successFade,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },
  earningsText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.success },

  // Address
  addressRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SPACING.sm,
    marginBottom:  SPACING.md,
    paddingLeft:   2,
  },
  addressDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: COLORS.error,
    marginTop:       4,
  },
  addressText: { flex: 1, fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20 },

  // Action button
  actionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    borderRadius:    RADIUS.full,
    paddingVertical: SPACING.md + 2,
    minHeight:       54,
  },
  actionBtnText: { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },

  waitingPlaceholder: { height: SPACING.md },

  navigateBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SPACING.sm,
    borderRadius:      RADIUS.full,
    borderWidth:       1.5,
    borderColor:       COLORS.primary,
    paddingVertical:   SPACING.md,
    marginBottom:      SPACING.sm,
  },
  navigateBtnText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },
})
