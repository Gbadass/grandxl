import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  Pressable,
} from 'react-native'
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ridersApi } from '@grandxl/api-client'
import type { Order } from '@grandxl/types'
import { Skeleton } from '../../src/components/atoms/Skeleton'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  const now   = new Date()
  const diff  = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function formatTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

type Period = 'today' | 'week' | 'month' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today'   },
  { key: 'week',  label: 'Week'    },
  { key: 'month', label: 'Month'   },
  { key: 'all',   label: 'All time'},
]

function filterByPeriod(orders: Order[], period: Period): Order[] {
  if (period === 'all') return orders
  const now  = new Date()
  const start = new Date(now)
  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
  }
  return orders.filter((o) => new Date(o.createdAt) >= start)
}

function groupByDate(orders: Order[]): { date: string; orders: Order[] }[] {
  const map = new Map<string, Order[]>()
  for (const o of orders) {
    const label = formatDate(o.createdAt)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(o)
  }
  return Array.from(map.entries()).map(([date, orders]) => ({ date, orders }))
}

function StatPill({
  icon,
  label,
  value,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  iconColor: string
}) {
  return (
    <View style={s.statPill}>
      <View style={[s.statIconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={s.statPillValue}>{value}</Text>
      <Text style={s.statPillLabel}>{label}</Text>
    </View>
  )
}

function TransactionRow({ order }: { order: Order }) {
  return (
    <View style={s.txRow}>
      <View style={s.txIconWrap}>
        <Ionicons name="bicycle" size={18} color={COLORS.primary} />
      </View>
      <View style={s.txMeta}>
        <Text style={s.txNumber}>{order.orderNumber}</Text>
        <Text style={s.txTime}>{formatTime(order.createdAt)}</Text>
      </View>
      <Text style={s.txAmount}>+{formatMoney(order.pricing.deliveryFee)}</Text>
    </View>
  )
}

function EarningsSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      {/* Hero card */}
      <View style={[s.hero, { backgroundColor: '#2C2C2E' }]}>
        <Skeleton width={120} height={10} borderRadius={5} style={{ marginBottom: SPACING.md }} />
        <Skeleton width={180} height={40} borderRadius={8} style={{ marginBottom: SPACING.lg }} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <Skeleton width={110} height={26} borderRadius={999} />
        </View>
      </View>

      {/* Period tabs */}
      <View style={[s.periodRow, { marginBottom: SPACING.md }]}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={60} height={30} borderRadius={RADIUS.sm} />
        ))}
      </View>

      {/* Summary card */}
      <View style={[s.summaryCard, { marginBottom: SPACING.lg }]}>
        <Skeleton width={90} height={10} borderRadius={5} style={{ marginBottom: SPACING.sm }} />
        <Skeleton width={160} height={32} borderRadius={8} style={{ marginBottom: SPACING.md }} />
        <View style={s.summaryDivider} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.md }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ alignItems: 'center', gap: SPACING.xs }}>
              <Skeleton width={38} height={38} borderRadius={12} />
              <Skeleton width={50} height={10} borderRadius={5} />
              <Skeleton width={36} height={8} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>

      {/* Transaction rows */}
      <View style={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}>
        <Skeleton width={100} height={10} borderRadius={5} style={{ marginBottom: SPACING.xs }} />
        <View style={[s.txCard, { padding: SPACING.md, gap: SPACING.md }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <Skeleton width={38} height={38} borderRadius={12} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width={100} height={10} borderRadius={5} />
                <Skeleton width={60} height={8} borderRadius={4} />
              </View>
              <Skeleton width={55} height={12} borderRadius={5} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default function EarningsScreen() {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('week')

  const {
    data: riderProfile,
    isLoading: profileLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey:  ['riderProfile'],
    queryFn:   () => ridersApi.getProfile().then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey:  ['riderDeliveries'],
    queryFn:   () => ridersApi.getDeliveryHistory({ limit: 100 }).then((r) => r.data.data.data),
    staleTime: 60_000,
  })

  const allOrders     = ordersData ?? []
  const filtered      = useMemo(() => filterByPeriod(allOrders, period), [allOrders, period])
  const periodEarnings= useMemo(() => filtered.reduce((s, o) => s + o.pricing.deliveryFee, 0), [filtered])
  const avgEarnings   = filtered.length > 0 ? Math.round(periodEarnings / filtered.length) : 0
  const groups        = useMemo(() => groupByDate(filtered), [filtered])

  const totalLifetime = riderProfile?.earnings.totalKobo ?? 0
  const pending       = riderProfile?.earnings.pendingKobo ?? 0
  const rating        = riderProfile?.rating ?? 0
  const deliveries    = riderProfile?.totalDeliveries ?? 0

  const isLoading = profileLoading || ordersLoading

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {isLoading ? (
        <EarningsSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
          }
        >
          {/* ── Hero card ─────────────────────────────────────── */}
          <View style={s.hero}>
            {/* Decorative circle */}
            <View style={s.heroCircle} />

            <Text style={s.heroEyebrow}>LIFETIME EARNINGS</Text>
            <Text style={s.heroAmount}>{formatMoney(totalLifetime)}</Text>

            <View style={s.heroMeta}>
              <View style={s.heroBadge}>
                <Ionicons name="bicycle-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={s.heroBadgeText}>{deliveries} deliveries</Text>
              </View>
              {pending > 0 && (
                <View style={[s.heroBadge, s.heroBadgePending]}>
                  <Ionicons name="time-outline" size={13} color="#FFE082" />
                  <Text style={[s.heroBadgeText, { color: '#FFE082' }]}>{formatMoney(pending)} pending</Text>
                </View>
              )}
            </View>

            <Pressable
              style={s.withdrawPill}
              onPress={() => router.push('/(rider)/payouts' as never)}
            >
              <Ionicons name="arrow-down-circle" size={16} color={COLORS.primary} />
              <Text style={s.withdrawPillText}>Withdraw earnings</Text>
            </Pressable>
          </View>

          {/* ── Period tabs ───────────────────────────────────── */}
          <View style={s.periodRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.key}
                style={[s.periodTab, period === p.key && s.periodTabActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[s.periodTabText, period === p.key && s.periodTabTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Period summary ────────────────────────────────── */}
          <View style={s.summaryCard}>
            <View style={s.summaryMain}>
              <Text style={s.summaryLabel}>
                {period === 'today' ? "Today's earnings" :
                 period === 'week'  ? "This week"         :
                 period === 'month' ? "This month"        : "All time"}
              </Text>
              <Text style={s.summaryAmount}>{formatMoney(periodEarnings)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryStats}>
              <StatPill icon="bicycle"       label="Trips"   value={`${filtered.length}`}      iconColor={COLORS.primary} />
              <StatPill icon="cash-outline"  label="Avg/trip" value={formatMoney(avgEarnings)}  iconColor="#3B82F6"        />
              <StatPill icon="star"          label="Rating"  value={`${rating.toFixed(1)}★`}   iconColor={COLORS.warning} />
            </View>
          </View>

          {/* ── Transaction history ───────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Transaction History</Text>

            {groups.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="receipt-outline" size={32} color={COLORS.textTertiary} />
                </View>
                <Text style={s.emptyTitle}>No deliveries yet</Text>
                <Text style={s.emptyBody}>
                  {period === 'all'
                    ? 'Complete your first delivery to see earnings here.'
                    : 'No deliveries in this period. Try a different range.'}
                </Text>
              </View>
            ) : (
              groups.map(({ date, orders }) => (
                <View key={date} style={s.group}>
                  <Text style={s.groupDate}>{date}</Text>
                  <View style={s.txCard}>
                    {orders.map((order, idx) => (
                      <View key={order._id}>
                        <TransactionRow order={order} />
                        {idx < orders.length - 1 && <View style={s.txDivider} />}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.surfaceHighlight,
    paddingTop:      Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Hero ──────────────────────────────────────────────────────
  hero: {
    margin:          SPACING.lg,
    borderRadius:    RADIUS.xl,
    padding:         SPACING.xl,
    paddingBottom:   SPACING.xxl,
    overflow:        'hidden',
    backgroundColor: '#1C1C1E',
    ...SHADOW.md,
  },
  heroCircle: {
    position:        'absolute',
    width:           200,
    height:          200,
    borderRadius:    100,
    backgroundColor: 'rgba(249,115,22,0.12)',
    right:           -40,
    top:             -60,
  },
  heroEyebrow: {
    fontSize:     FONT.xs,
    fontFamily:   FONTS.semibold,
    color:        'rgba(255,255,255,0.5)',
    letterSpacing: 1.2,
    marginBottom:  SPACING.sm,
  },
  heroAmount: {
    fontSize:   40,
    fontFamily: FONTS.bold,
    color:      '#FFFFFF',
    marginBottom: SPACING.md,
  },
  heroMeta:   { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  heroBadge:  {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius:    RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical:  5,
  },
  heroBadgePending: { backgroundColor: 'rgba(255,224,130,0.15)' },

  withdrawPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: RADIUS.full,
    paddingHorizontal: 16, paddingVertical: 9,
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
  },
  withdrawPillText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.primary },
  heroBadgeText: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: 'rgba(255,255,255,0.7)' },

  // ── Period tabs ───────────────────────────────────────────────
  periodRow: {
    flexDirection:     'row',
    marginHorizontal:  SPACING.lg,
    marginBottom:      SPACING.md,
    backgroundColor:   COLORS.bg,
    borderRadius:      RADIUS.md,
    padding:           3,
    ...SHADOW.sm,
  },
  periodTab: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: SPACING.sm,
    borderRadius:    RADIUS.sm,
  },
  periodTabActive: { backgroundColor: COLORS.primary },
  periodTabText:   { fontSize: FONT.xs, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  periodTabTextActive: { color: '#fff' },

  // ── Summary card ──────────────────────────────────────────────
  summaryCard: {
    marginHorizontal: SPACING.lg,
    marginBottom:     SPACING.lg,
    backgroundColor:  COLORS.bg,
    borderRadius:     RADIUS.lg,
    padding:          SPACING.lg,
    ...SHADOW.sm,
  },
  summaryMain:   { marginBottom: SPACING.md },
  summaryLabel:  { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  summaryAmount: { fontSize: FONT.xxxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginTop: 2 },
  summaryDivider:{ height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.md },
  summaryStats:  { flexDirection: 'row', justifyContent: 'space-around' },

  // ── Stat pill ─────────────────────────────────────────────────
  statPill:       { alignItems: 'center', gap: SPACING.xs },
  statIconWrap:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statPillValue:  { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statPillLabel:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  // ── Transaction history ───────────────────────────────────────
  section:      { paddingHorizontal: SPACING.lg },
  sectionTitle: {
    fontSize:    FONT.md,
    fontFamily:  FONTS.semibold,
    color:       COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  group:        { marginBottom: SPACING.md },
  groupDate:    {
    fontSize:    FONT.xs,
    fontFamily:  FONTS.semibold,
    color:       COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  txCard: {
    backgroundColor: COLORS.bg,
    borderRadius:    RADIUS.md,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingVertical:   SPACING.md,
    paddingHorizontal: SPACING.md,
    gap:           SPACING.md,
  },
  txIconWrap: {
    width:           38,
    height:          38,
    borderRadius:    12,
    backgroundColor: COLORS.primaryFade,
    alignItems:      'center',
    justifyContent:  'center',
  },
  txMeta:     { flex: 1, gap: 2 },
  txNumber:   { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  txTime:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  txAmount:   { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.success },
  txDivider:  { height: 1, backgroundColor: COLORS.border, marginLeft: 54 },

  // ── Empty state ───────────────────────────────────────────────
  empty: {
    alignItems:     'center',
    paddingVertical: SPACING.xxxl,
    gap:            SPACING.md,
  },
  emptyIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyTitle: { fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  emptyBody:  { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },
})
