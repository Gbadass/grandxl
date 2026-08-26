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
} from 'react-native'
import { confirm } from '../../../../src/lib/confirm'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi } from '@grandxl/api-client'
import type { Order } from '@grandxl/types'
import { OrderStatus } from '@grandxl/types'
import { useLocationStore } from '../../../../src/store/location.store'
import { socket } from '../../../../src/lib/socket'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../../src/theme'

const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PENDING]:   'Waiting for restaurant to confirm…',
  [OrderStatus.CONFIRMED]: 'Restaurant confirmed your order',
  [OrderStatus.PREPARING]: 'Chef is preparing your food 👨‍🍳',
  [OrderStatus.READY]:     'Order is ready — waiting for rider',
  [OrderStatus.PICKED_UP]: 'Rider is on the way! 🛵',
  [OrderStatus.DELIVERED]: 'Order delivered. Enjoy! 🎉',
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const userLocation = useLocationStore()
  const mapRef = useRef<MapView>(null)
  // Fit-to-coordinates only once — otherwise every rider GPS tick re-fits the map
  // and the viewport thrashes; user can't pan/zoom without it snapping back.
  const fittedRef = useRef(false)

  // Rider live lat/lng (updated via polling)
  const [riderCoords, setRiderCoords] = useState<{ lat: number; lng: number } | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn:  () => ordersApi.getById(id).then((r) => r.data.data),
    refetchInterval: 10_000,
  })

  // Fetch rider contact only when a rider has been assigned and the order is in flight.
  const hasRider = !!order?.riderId && [
    OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP,
  ].includes(order.status as OrderStatus)
  const { data: rider } = useQuery({
    queryKey: ['order', id, 'rider-contact'],
    queryFn:  () => ordersApi.getRiderContact(id).then((r) => r.data.data),
    enabled:  hasRider,
    staleTime: 5 * 60_000,
  })

  function callRider() {
    if (!rider?.phone) {
      void confirm({
        title:   'No phone number',
        message: 'The rider\'s phone number is unavailable. Please contact support.',
        mode:    'alert',
        icon:    'info',
      })
      return
    }
    void Linking.openURL(`tel:${rider.phone}`)
  }

  // Join the order's socket room and subscribe to live rider location
  useEffect(() => {
    if (!id) return
    socket.emit('order:join_room', { orderId: id })

    // Named handler so socket.off can remove ONLY this listener; anonymous listeners
    // can't be individually removed and pile up on remount.
    function onRiderLocation(data: { riderId: string; lat: number; lng: number; bearing: number }) {
      setRiderCoords({ lat: data.lat, lng: data.lng })
    }
    socket.on('rider:location', onRiderLocation)

    return () => {
      socket.emit('order:leave_room', { orderId: id })
      socket.off('rider:location', onRiderLocation)
    }
  }, [id])

  // Extract delivery coords from order
  const deliveryCoords = order?.deliveryAddress.coordinates
    ? {
        lat: order.deliveryAddress.coordinates.coordinates[1],
        lng: order.deliveryAddress.coordinates.coordinates[0],
      }
    : null

  // Center map ONCE when we first have delivery coords. Re-fitting on every
  // rider tick makes the map viewport thrash and steals the user's pan/zoom.
  useEffect(() => {
    if (fittedRef.current || !mapRef.current || !deliveryCoords) return
    const coords = [
      deliveryCoords,
      ...(riderCoords ? [riderCoords] : []),
      ...(userLocation.lat && userLocation.lng ? [{ lat: userLocation.lat, lng: userLocation.lng }] : []),
    ]
    mapRef.current.fitToCoordinates(
      coords.map((c) => ({ latitude: c.lat, longitude: c.lng })),
      { edgePadding: { top: 80, right: 40, bottom: 200, left: 40 }, animated: true },
    )
    fittedRef.current = true
  }, [deliveryCoords, riderCoords])

  if (isLoading || !order) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Track Order</Text>
          <View style={s.backBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    )
  }

  const statusLabel = STATUS_LABEL[order.status as OrderStatus] ?? 'Order in progress'
  const isDelivered = order.status === OrderStatus.DELIVERED

  const initialRegion = deliveryCoords
    ? {
        latitude:       deliveryCoords.lat,
        longitude:      deliveryCoords.lng,
        latitudeDelta:  0.03,
        longitudeDelta: 0.03,
      }
    : {
        latitude:       6.5244,
        longitude:      3.3792,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onMapReady={() => {
          // Fit happens here too — fitToCoordinates from useEffect can fire before
          // the native module is laid out (especially on iOS), leaving markers off-screen.
          if (!mapRef.current || !deliveryCoords) return
          const coords = [
            deliveryCoords,
            ...(riderCoords ? [riderCoords] : []),
            ...(userLocation.lat && userLocation.lng ? [{ lat: userLocation.lat, lng: userLocation.lng }] : []),
          ]
          mapRef.current.fitToCoordinates(
            coords.map((c) => ({ latitude: c.lat, longitude: c.lng })),
            { edgePadding: { top: 80, right: 40, bottom: 280, left: 40 }, animated: false },
          )
        }}
      >
        {/* Delivery destination */}
        {deliveryCoords && (
          <Marker
            coordinate={{ latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }}
            title="Delivery address"
            pinColor={COLORS.primary}
          />
        )}

        {/* Rider */}
        {riderCoords && (
          <Marker
            coordinate={{ latitude: riderCoords.lat, longitude: riderCoords.lng }}
            title="Your rider"
          >
            <View style={s.riderMarker}>
              <Text style={{ fontSize: 20 }}>🛵</Text>
            </View>
          </Marker>
        )}

        {/* Route line */}
        {riderCoords && deliveryCoords && (
          <Polyline
            coordinates={[
              { latitude: riderCoords.lat, longitude: riderCoords.lng },
              { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng },
            ]}
            strokeColor={COLORS.primary}
            strokeWidth={3}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>

      {/* Back button over map */}
      <SafeAreaView style={s.mapOverlay} pointerEvents="box-none">
        <Pressable style={s.floatBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
      </SafeAreaView>

      {/* Bottom sheet */}
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        <Text style={s.statusLabel}>{statusLabel}</Text>

        {order.estimatedTime && !isDelivered && (
          <View style={s.etaRow}>
            <Ionicons name="time-outline" size={16} color={COLORS.primary} />
            <Text style={s.etaText}>Est. {order.estimatedTime} min remaining</Text>
          </View>
        )}

        {isDelivered && (
          <View style={s.deliveredRow}>
            <Text style={s.deliveredEmoji}>🎉</Text>
            <Text style={s.deliveredText}>Your order has been delivered!</Text>
          </View>
        )}

        {hasRider && rider && (
          <View style={s.riderCard}>
            <View style={s.riderAvatar}>
              <Text style={s.riderAvatarText}>
                {`${rider.firstName[0] ?? ''}${rider.lastName[0] ?? ''}`.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={s.riderMeta}>
              <Text style={s.riderName} numberOfLines={1}>{rider.firstName} {rider.lastName}</Text>
              <Text style={s.riderSub} numberOfLines={1}>
                Your rider
                {rider.vehicleType ? ` · ${rider.vehicleType}` : ''}
                {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ''}
              </Text>
            </View>
            <Pressable style={s.callBtn} onPress={callRider} disabled={!rider.phone}>
              <Ionicons name="call" size={16} color="#fff" />
              <Text style={s.callBtnText}>Call</Text>
            </Pressable>
          </View>
        )}

        <View style={s.orderInfo}>
          <Text style={s.orderInfoLabel}>{order.orderNumber}</Text>
          <Text style={s.orderInfoItems}>
            {order.items.map((i) => `${i.quantity}× ${i.name}`).join('  ·  ')}
          </Text>
        </View>

        <Pressable style={s.detailBtn} onPress={() => router.back()}>
          <Text style={s.detailBtnText}>View Order Details</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: COLORS.bg,
    paddingTop:      Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  backBtn: { width: 48, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },

  // Map overlay
  mapOverlay: {
    position:   'absolute',
    top:        0,
    left:       0,
    right:      0,
  },
  floatBack: {
    margin:          SPACING.lg,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.bg,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.md,
  },

  // Rider marker
  riderMarker: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.bg,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.sm,
  },

  // Bottom sheet
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom:   Platform.OS === 'ios' ? 34 : SPACING.xl,
    paddingTop:      SPACING.md,
    ...SHADOW.md,
  },
  sheetHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: COLORS.border,
    alignSelf:       'center',
    marginBottom:    SPACING.md,
  },
  statusLabel: {
    fontSize:     FONT.lg,
    fontFamily:   FONTS.semibold,
    color:        COLORS.textPrimary,
    textAlign:    'center',
    marginBottom: SPACING.sm,
  },
  etaRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.xs,
    marginBottom:    SPACING.md,
  },
  etaText: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary },

  deliveredRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    marginBottom:    SPACING.md,
  },
  deliveredEmoji: { fontSize: 24 },
  deliveredText:  { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.success },

  riderCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.md,
    backgroundColor: '#F0FDF4',
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
    borderWidth:     1,
    borderColor:     '#BBF7D0',
  },
  riderAvatar: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: '#16A34A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  riderAvatarText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  riderMeta: { flex: 1, minWidth: 0 },
  riderName: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#14532D' },
  riderSub:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: '#166534', marginTop: 2 },
  callBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: '#16A34A',
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  callBtnText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: '#fff' },

  orderInfo: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    marginBottom:    SPACING.md,
    gap:             4,
  },
  orderInfoLabel: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  orderInfoItems: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  detailBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems:      'center',
  },
  detailBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },
})
