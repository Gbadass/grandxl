import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  Linking,
} from 'react-native'
import { toast } from '../../../../src/lib/toast'
import { confirm } from '../../../../src/lib/confirm'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi } from '@grandxl/api-client'
import type { Order, OrderItem } from '@grandxl/types'
import { OrderStatus, PaymentMethod } from '@grandxl/types'

import { socket } from '../../../../src/lib/socket'
import { Skeleton } from '../../../../src/components/atoms/Skeleton'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Timeline config ───────────────────────────────────────────────────────────
const STEPS: {
  status: OrderStatus
  label: string
  sublabel: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { status: OrderStatus.PENDING,   label: 'Order placed',  sublabel: 'We received your order',          icon: 'receipt-outline'    },
  { status: OrderStatus.CONFIRMED, label: 'Confirmed',     sublabel: 'Restaurant accepted your order',  icon: 'checkmark-circle-outline' },
  { status: OrderStatus.PREPARING, label: 'Preparing',     sublabel: 'Chef is cooking your food',        icon: 'restaurant-outline' },
  { status: OrderStatus.READY,     label: 'Ready',         sublabel: 'Order packed and ready for pickup',icon: 'cube-outline'       },
  { status: OrderStatus.PICKED_UP, label: 'On the way',    sublabel: 'Rider picked up your order',       icon: 'bicycle-outline'    },
  { status: OrderStatus.DELIVERED, label: 'Delivered',     sublabel: 'Enjoy your meal!',                 icon: 'home-outline'       },
]

const STATUS_INDEX: Record<string, number> = Object.fromEntries(
  STEPS.map((s, i) => [s.status, i]),
)

// Hero card config per status
const STATUS_HERO: Partial<Record<OrderStatus, {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  bg: string
  fg: string
}>> = {
  [OrderStatus.PENDING]:   { label: 'Waiting for confirmation',    icon: 'time-outline',         bg: '#FFF7ED', fg: COLORS.warning  },
  [OrderStatus.CONFIRMED]: { label: 'Order confirmed',             icon: 'checkmark-circle',     bg: '#EFF6FF', fg: '#3B82F6'       },
  [OrderStatus.PREPARING]: { label: 'Being prepared',              icon: 'restaurant',           bg: '#FFF7ED', fg: COLORS.primary  },
  [OrderStatus.READY]:     { label: 'Ready for pickup',            icon: 'cube',                 bg: '#FFF7ED', fg: COLORS.primary  },
  [OrderStatus.PICKED_UP]: { label: 'On the way to you!',          icon: 'bicycle',              bg: '#F0FDF4', fg: COLORS.success  },
  [OrderStatus.DELIVERED]: { label: 'Delivered successfully',      icon: 'checkmark-done-circle',bg: '#F0FDF4', fg: COLORS.success  },
  [OrderStatus.CANCELLED]: { label: 'Order cancelled',             icon: 'close-circle',         bg: '#FEF2F2', fg: COLORS.error    },
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ status }: { status: string }) {
  const currentIdx  = STATUS_INDEX[status] ?? -1
  const isCancelled = status === OrderStatus.CANCELLED

  if (isCancelled) {
    return (
      <View style={tl.cancelCard}>
        <View style={[tl.iconWrap, { backgroundColor: COLORS.errorFade }]}>
          <Ionicons name="close-circle" size={24} color={COLORS.error} />
        </View>
        <View>
          <Text style={[tl.doneLabel, { color: COLORS.error }]}>Order Cancelled</Text>
          <Text style={tl.sub}>This order has been cancelled.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={tl.wrap}>
      {STEPS.map((step, idx) => {
        const done    = idx < currentIdx
        const current = idx === currentIdx
        const future  = idx > currentIdx
        const isLast  = idx === STEPS.length - 1

        return (
          <View key={step.status} style={tl.row}>
            {/* Left column: icon + connector line */}
            <View style={tl.left}>
              <View style={[
                tl.iconWrap,
                done    && tl.iconDone,
                current && tl.iconCurrent,
                future  && tl.iconFuture,
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Ionicons name={step.icon} size={14} color={current ? '#fff' : COLORS.textTertiary} />
                }
              </View>
              {!isLast && (
                <View style={[tl.line, (done || current) && idx < currentIdx && tl.lineDone]} />
              )}
            </View>

            {/* Right column: text */}
            <View style={[tl.right, isLast && { paddingBottom: 0 }]}>
              <Text style={[
                tl.label,
                done    && tl.doneLabel,
                current && tl.currentLabel,
              ]}>
                {step.label}
              </Text>
              {(done || current) && (
                <Text style={tl.sub}>{step.sublabel}</Text>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// ── Item row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, last }: { item: OrderItem; last: boolean }) {
  return (
    <View style={[s.itemRow, last && { borderBottomWidth: 0 }]}>
      <View style={s.itemQty}>
        <Text style={s.itemQtyText}>{item.quantity}×</Text>
      </View>
      <View style={s.itemMeta}>
        <Text style={s.itemName}>{item.name}</Text>
        {item.selectedVariants.length > 0 && (
          <Text style={s.itemSub}>{item.selectedVariants.map((v) => v.optionName).join(', ')}</Text>
        )}
        {item.selectedAddOns.length > 0 && (
          <Text style={s.itemSub}>+ {item.selectedAddOns.map((a) => a.name).join(', ')}</Text>
        )}
      </View>
      <Text style={s.itemPrice}>{formatMoney(item.itemTotal)}</Text>
    </View>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function OrderDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Skeleton width={170} height={13} borderRadius={6} />
        <View style={s.headerBtn} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Skeleton width="100%" height={96} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.md }} />
        <View style={[s.card, { padding: SPACING.lg, gap: SPACING.lg }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: SPACING.md, alignItems: 'center' }}>
              <Skeleton width={32} height={32} borderRadius={16} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={90} height={11} borderRadius={5} />
                <Skeleton width={140} height={9} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: SPACING.lg }} />
        <View style={[s.card, { padding: SPACING.lg, gap: SPACING.md }]}>
          <Skeleton width={80} height={11} borderRadius={5} />
          {[0, 1].map((i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={120} height={32} borderRadius={RADIUS.sm} />
              <Skeleton width={60} height={10} borderRadius={5} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const qc      = useQueryClient()

  const [dispatchPhase, setDispatchPhase] = useState<'searching' | 'broadcast' | 'no_riders' | null>(null)

  useEffect(() => {
    if (!id) return
    const handler = (data: { orderId: string; phase: 'searching' | 'broadcast' | 'no_riders' }) => {
      if (data.orderId === id) setDispatchPhase(data.phase)
    }
    socket.on('order:dispatch_update', handler)
    return () => { socket.off('order:dispatch_update', handler) }
  }, [id])

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn:  () => ordersApi.getById(id).then((r) => r.data.data),
    enabled:  !!id,
    retry: 2,
    refetchInterval: (query) => {
      const o = query.state.data as Order | undefined
      if (!o) return false
      const active = new Set([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP])
      return active.has(o.status as OrderStatus) ? 10_000 : false
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(id).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err: Error) => toast.error(`Cancel failed: ${err.message}`),
  })

  // Fetch rider contact only when a rider is assigned and order is in flight.
  const inFlight = order?.status && [
    OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP,
  ].includes(order.status as OrderStatus)
  const { data: rider } = useQuery({
    queryKey: ['order', id, 'rider-contact'],
    queryFn:  () => ordersApi.getRiderContact(id).then((r) => r.data.data),
    enabled:  !!order?.riderId && !!inFlight,
    staleTime: 5 * 60_000,
  })

  function callRider() {
    if (!rider?.phone) {
      void confirm({
        title:   'No phone number',
        message: "The rider's phone number is unavailable. Please contact support.",
        mode:    'alert',
        icon:    'info',
      })
      return
    }
    void Linking.openURL(`tel:${rider.phone}`)
  }

  if (isLoading) return <OrderDetailSkeleton onBack={() => router.back()} />

  if (!order) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Order</Text>
          <View style={s.headerBtn} />
        </View>
        <View style={s.errorState}>
          <View style={s.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.error} />
          </View>
          <Text style={s.errorTitle}>Could not load order</Text>
          <Text style={s.errorBody}>
            {(() => {
              const e = error as { response?: { status?: number; data?: { message?: string } }; message?: string } | null
              if (e?.response?.status) return `HTTP ${e.response.status}: ${e.response.data?.message ?? 'Error'}`
              return e?.message ?? 'Check your connection and try again.'
            })()}
          </Text>
          <View style={s.errorActions}>
            <Pressable style={s.retryBtn} onPress={() => void refetch()}>
              <Text style={s.retryBtnText}>Retry</Text>
            </Pressable>
            <Pressable style={s.backBtnOutline} onPress={() => router.back()}>
              <Text style={s.backBtnOutlineText}>Go back</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const canCancel = order.status === OrderStatus.PENDING
  const isActive  = new Set([
    OrderStatus.PENDING, OrderStatus.CONFIRMED,
    OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP,
  ]).has(order.status as OrderStatus)

  const hero = STATUS_HERO[order.status as OrderStatus]

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.headerBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{order.orderNumber}</Text>
        {isActive ? (
          <Pressable
            style={s.trackBtn}
            onPress={() => router.push(`/(customer)/orders/${id}/tracking` as never)}
          >
            <Ionicons name="navigate" size={14} color={COLORS.primary} />
            <Text style={s.trackBtnText}>Track</Text>
          </Pressable>
        ) : (
          <View style={s.headerBtn} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Status hero ──────────────────────────────────────────────────── */}
        {hero && (
          <View style={[s.heroCard, { backgroundColor: hero.bg }]}>
            <View style={[s.heroIconWrap, { backgroundColor: hero.fg + '22' }]}>
              <Ionicons name={hero.icon} size={28} color={hero.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroLabel, { color: hero.fg }]}>{hero.label}</Text>
              <Text style={s.heroSub}>Placed {formatDate(order.createdAt)}</Text>
            </View>
          </View>
        )}

        {/* ── Rider search / assigned banner ───────────────────────────────── */}
        {!order.riderId && [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY].includes(order.status as OrderStatus) && (
          <View style={[s.riderBanner, { borderColor: 'rgba(249,115,22,0.2)', backgroundColor: '#FFF7ED' }]}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <View style={{ flex: 1 }}>
              <Text style={[s.riderBannerTitle, { color: COLORS.primary }]}>
                {dispatchPhase === 'broadcast'
                  ? 'Expanding search area…'
                  : dispatchPhase === 'no_riders'
                  ? 'All riders are busy right now…'
                  : order.status === OrderStatus.READY
                  ? 'Food is ready — finding a rider'
                  : 'Looking for a nearby rider'}
              </Text>
              <Text style={s.riderBannerSub}>
                {dispatchPhase === 'broadcast'
                  ? 'No nearby riders responded. Notifying all available riders in your area.'
                  : dispatchPhase === 'no_riders'
                  ? "We're continuing to search. You'll be notified as soon as a rider accepts."
                  : order.status === OrderStatus.READY
                  ? 'Your order is packed and waiting. A rider will collect it shortly.'
                  : 'A rider close to you is being notified. Usually takes 1–2 min.'}
              </Text>
            </View>
          </View>
        )}

        {order.riderId && [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP].includes(order.status as OrderStatus) && (
          <View style={s.riderContactCard}>
            <View style={s.riderContactTop}>
              <View style={s.riderAvatar}>
                {rider
                  ? (
                    <Text style={s.riderAvatarText}>
                      {`${rider.firstName?.[0] ?? ''}${rider.lastName?.[0] ?? ''}`.toUpperCase() || '?'}
                    </Text>
                  )
                  : <Ionicons name="bicycle" size={20} color="#fff" />
                }
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.riderContactName} numberOfLines={1}>
                  {rider ? `${rider.firstName} ${rider.lastName}` : 'Rider assigned'}
                </Text>
                <Text style={s.riderContactSub} numberOfLines={1}>
                  {order.status === OrderStatus.PICKED_UP
                    ? 'On the way to you'
                    : 'Heading to the restaurant'}
                  {rider?.vehicleType ? ` · ${rider.vehicleType}` : ''}
                  {rider?.vehiclePlate ? ` · ${rider.vehiclePlate}` : ''}
                </Text>
              </View>
            </View>
            <View style={s.riderContactActions}>
              <Pressable
                style={[s.contactBtn, s.callBtn, !rider?.phone && { opacity: 0.5 }]}
                onPress={callRider}
                disabled={!rider?.phone}
              >
                <Ionicons name="call" size={15} color="#fff" />
                <Text style={s.callBtnText}>Call rider</Text>
              </Pressable>
              {isActive && (
                <Pressable
                  style={[s.contactBtn, s.trackBtnLg]}
                  onPress={() => router.push(`/(customer)/orders/${id}/tracking` as never)}
                >
                  <Ionicons name="navigate-outline" size={15} color={COLORS.success} />
                  <Text style={s.trackBtnLgText}>Track</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Order timeline ────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Order Status</Text>
          <Timeline status={order.status} />
        </View>

        {/* ── Items ────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Items</Text>
          {order.items.map((item, i) => (
            <ItemRow
              key={`${item.menuItemId}-${i}`}
              item={item}
              last={i === order.items.length - 1}
            />
          ))}
        </View>

        {/* ── Delivery address ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Delivery Address</Text>
          <View style={s.addrRow}>
            <View style={s.addrDot} />
            <Text style={s.addrText}>
              {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state}
            </Text>
          </View>
        </View>

        {/* ── Bill + Payment combined ───────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bill Details</Text>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Subtotal</Text>
            <Text style={s.billValue}>{formatMoney(order.pricing.subtotal)}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Delivery fee</Text>
            <Text style={s.billValue}>{formatMoney(order.pricing.deliveryFee)}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Service fee</Text>
            <Text style={s.billValue}>{formatMoney(order.pricing.serviceFee)}</Text>
          </View>
          {order.pricing.discount > 0 && (
            <View style={s.billRow}>
              <Text style={[s.billLabel, { color: COLORS.success }]}>Discount</Text>
              <Text style={[s.billValue, { color: COLORS.success }]}>-{formatMoney(order.pricing.discount)}</Text>
            </View>
          )}

          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{formatMoney(order.pricing.total)}</Text>
          </View>

          <View style={s.paymentRow}>
            <View style={s.paymentLeft}>
              <Ionicons
                name={order.payment.method === PaymentMethod.CASH ? 'cash-outline' : 'card-outline'}
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={s.paymentMethod}>{order.payment.method.toUpperCase()}</Text>
            </View>
            <View style={[
              s.paymentBadge,
              order.payment.status === 'completed'
                ? { backgroundColor: COLORS.successFade }
                : { backgroundColor: 'rgba(245,158,11,0.12)' },
            ]}>
              <Text style={[
                s.paymentBadgeText,
                { color: order.payment.status === 'completed' ? COLORS.success : COLORS.warning },
              ]}>
                {order.payment.status}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Cancel ───────────────────────────────────────────────────────── */}
        {canCancel && (
          <Pressable
            style={[s.cancelBtn, cancelMutation.isPending && { opacity: 0.6 }]}
            onPress={async () => {
              const ok = await confirm({
                title:        'Cancel order?',
                message:      'This action can\'t be undone.',
                confirmLabel: 'Cancel Order',
                cancelLabel:  'Keep Order',
                variant:      'destructive',
                icon:         'warning',
              })
              if (ok) cancelMutation.mutate()
            }}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending
              ? <ActivityIndicator color={COLORS.error} size="small" />
              : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                  <Text style={s.cancelBtnText}>Cancel Order</Text>
                </>
              )
            }
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Timeline styles ───────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  wrap:       { gap: 0 },
  cancelCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },

  row:  { flexDirection: 'row', gap: SPACING.md },
  left: { alignItems: 'center', width: 32 },

  iconWrap: {
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: COLORS.surfaceHighlight,
  },
  iconDone:    { backgroundColor: COLORS.success },
  iconCurrent: { backgroundColor: COLORS.primary },
  iconFuture:  { backgroundColor: COLORS.surfaceHighlight },

  line: {
    width:           2,
    flex:            1,
    backgroundColor: COLORS.border,
    minHeight:       20,
    marginVertical:  3,
  },
  lineDone: { backgroundColor: COLORS.success },

  right:        { flex: 1, paddingBottom: SPACING.lg, paddingTop: 6 },
  label:        { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  doneLabel:    { color: COLORS.textSecondary, fontFamily: FONTS.medium },
  currentLabel: { color: COLORS.textPrimary, fontFamily: FONTS.bold },
  sub:          { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },
})

// ── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.surfaceHighlight,
    paddingTop:      Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:   COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn:   { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  trackBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, width: 44, justifyContent: 'flex-end' },
  trackBtnText:{ fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.primary },

  scroll: { padding: SPACING.lg, gap: SPACING.md },

  // Hero card
  heroCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.md,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.lg,
  },
  heroIconWrap: {
    width:           52,
    height:          52,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
  },
  heroLabel: { fontSize: FONT.md, fontFamily: FONTS.bold },
  heroSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },

  // Rider banner
  riderBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.md,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    padding:         SPACING.md,
  },
  riderIconWrap: {
    width:           36,
    height:          36,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  riderBannerTitle: { fontSize: FONT.sm, fontFamily: FONTS.bold, marginBottom: 2 },
  riderBannerSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  trackPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    borderColor:       COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   5,
  },
  trackPillText: { fontSize: FONT.xs, fontFamily: FONTS.semibold, color: COLORS.success },

  // Rider contact card (richer than the banner)
  riderContactCard: {
    backgroundColor: '#F0FDF4',
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     '#BBF7D0',
    padding:         SPACING.md,
    gap:             SPACING.md,
  },
  riderContactTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.md,
  },
  riderAvatar: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: '#16A34A',
    alignItems:      'center',
    justifyContent:  'center',
  },
  riderAvatarText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
  riderContactName: { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#14532D' },
  riderContactSub:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: '#166534', marginTop: 2 },
  riderContactActions: {
    flexDirection: 'row',
    gap:           SPACING.sm,
  },
  contactBtn: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    borderRadius:      RADIUS.full,
    paddingVertical:   10,
    paddingHorizontal: SPACING.md,
  },
  callBtn:     { backgroundColor: '#16A34A' },
  callBtnText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: '#fff' },
  trackBtnLg:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.success },
  trackBtnLgText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.success },

  // Card
  card: {
    backgroundColor: COLORS.bg,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.lg,
    ...SHADOW.sm,
  },
  cardTitle: {
    fontSize:     FONT.md,
    fontFamily:   FONTS.bold,
    color:        COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },

  // Items
  itemRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               SPACING.md,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemQty: {
    width:           30,
    height:          30,
    borderRadius:    9,
    backgroundColor: COLORS.primaryFade,
    alignItems:      'center',
    justifyContent:  'center',
  },
  itemQtyText: { fontSize: FONT.xs, fontFamily: FONTS.bold, color: COLORS.primary },
  itemMeta:    { flex: 1, gap: 2 },
  itemName:    { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  itemSub:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  itemPrice:   { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  // Address
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  addrDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: COLORS.error,
    marginTop:       5,
  },
  addrText: { flex: 1, fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20 },

  // Bill
  billRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  billLabel: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  billValue: { fontSize: FONT.sm, fontFamily: FONTS.medium,  color: COLORS.textPrimary   },

  totalRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalLabel: { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  totalValue: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.primary },

  paymentRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingTop:     SPACING.md,
  },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  paymentMethod: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  paymentBadge: {
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   4,
  },
  paymentBadgeText: { fontSize: FONT.xs, fontFamily: FONTS.semibold, textTransform: 'capitalize' },

  // Cancel
  cancelBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    borderWidth:     1.5,
    borderColor:     COLORS.error,
    borderRadius:    RADIUS.full,
    paddingVertical: SPACING.md,
    minHeight:       50,
    backgroundColor: COLORS.bg,
  },
  cancelBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.error },

  // Error state
  errorState: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  errorIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    22,
    backgroundColor: COLORS.errorFade,
    alignItems:      'center',
    justifyContent:  'center',
  },
  errorTitle:   { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  errorBody:    { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.md,
    backgroundColor:   COLORS.primary,
    borderRadius:      RADIUS.full,
  },
  retryBtnText:      { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: '#fff' },
  backBtnOutline: {
    paddingHorizontal: SPACING.xl,
    paddingVertical:   SPACING.md,
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderRadius:      RADIUS.full,
  },
  backBtnOutlineText:{ fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
})
