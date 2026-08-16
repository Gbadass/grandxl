import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native'
import { toast } from '../../src/lib/toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { ridersApi } from '@grandxl/api-client'
import type { Order } from '@grandxl/types'
import { OrderStatus } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { startRiderLocationTracking, stopRiderLocationTracking } from '../../src/hooks/useRiderLocation'
import { Skeleton } from '../../src/components/atoms/Skeleton'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Pulsing dot for "online" indicator ──────────────────────────────────────
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.8, duration: 900, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [scale, opacity])

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position:        'absolute',
          width:           14,
          height:          14,
          borderRadius:    7,
          backgroundColor: COLORS.success,
          transform:       [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success }} />
    </View>
  )
}

// ── Job card ─────────────────────────────────────────────────────────────────
function JobCard({ order, onAccept, accepting }: { order: Order; onAccept: () => void; accepting: boolean }) {
  const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0)

  const statusLabel =
    order.status === OrderStatus.READY     ? 'Ready for pickup' :
    order.status === OrderStatus.PREPARING ? 'Preparing'        : 'Confirmed'
  const statusColor =
    order.status === OrderStatus.READY     ? COLORS.success :
    order.status === OrderStatus.PREPARING ? COLORS.primary : COLORS.warning

  return (
    <View style={j.card}>
      {/* Top row: order # + earnings */}
      <View style={j.topRow}>
        <View style={j.topLeft}>
          <Text style={j.orderNum}>{order.orderNumber}</Text>
          <View style={[j.statusChip, { backgroundColor: statusColor + '18' }]}>
            <View style={[j.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[j.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={j.earningsBox}>
          <Text style={j.earningsLabel}>Your cut</Text>
          <Text style={j.earningsAmount}>{formatMoney(order.pricing.deliveryFee)}</Text>
        </View>
      </View>

      <View style={j.divider} />

      {/* Details */}
      <View style={j.details}>
        <View style={j.detailRow}>
          <View style={[j.detailIcon, { backgroundColor: COLORS.primaryFade }]}>
            <Ionicons name="restaurant" size={13} color={COLORS.primary} />
          </View>
          <Text style={j.detailText} numberOfLines={1}>
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {order.items[0]?.name ? ` · ${order.items[0].name}${itemCount > 1 ? ` +${itemCount - 1}` : ''}` : ''}
          </Text>
        </View>
        <View style={j.detailRow}>
          <View style={[j.detailIcon, { backgroundColor: COLORS.errorFade }]}>
            <Ionicons name="location" size={13} color={COLORS.error} />
          </View>
          <Text style={j.detailText} numberOfLines={1}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}
          </Text>
        </View>
        <View style={j.detailRow}>
          <View style={[j.detailIcon, { backgroundColor: COLORS.successFade }]}>
            <Ionicons name="wallet" size={13} color={COLORS.success} />
          </View>
          <Text style={j.detailText}>
            Order total {formatMoney(order.pricing.total)}
          </Text>
        </View>
      </View>

      {/* Accept button */}
      <Pressable
        style={[j.acceptBtn, accepting && { opacity: 0.6 }]}
        onPress={onAccept}
        disabled={accepting}
      >
        {accepting
          ? <ActivityIndicator color="#fff" size="small" />
          : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={j.acceptBtnText}>Accept Job</Text>
            </>
          )
        }
      </Pressable>
    </View>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function JobsSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, gap: SPACING.md }}>
      <Skeleton width={140} height={10} borderRadius={5} />
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: COLORS.bg,
            borderRadius: RADIUS.lg,
            padding: SPACING.md,
            gap: SPACING.md,
            ...SHADOW.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 8 }}>
              <Skeleton width={100} height={11} borderRadius={5} />
              <Skeleton width={75} height={22} borderRadius={RADIUS.full} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Skeleton width={50} height={9} borderRadius={4} />
              <Skeleton width={70} height={18} borderRadius={5} />
            </View>
          </View>
          <Skeleton width="100%" height={1} borderRadius={0} />
          <Skeleton width="75%" height={9} borderRadius={4} />
          <Skeleton width="60%" height={9} borderRadius={4} />
          <Skeleton width="100%" height={46} borderRadius={RADIUS.full} style={{ marginTop: SPACING.xs }} />
        </View>
      ))}
    </View>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function RiderJobsScreen() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: riderProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['riderProfile'],
    queryFn:  () => ridersApi.getProfile().then((r) => r.data.data),
    refetchInterval: 30_000,
  })

  const { data: ordersData, isLoading: ordersLoading, isRefetching, refetch } = useQuery({
    queryKey: ['riderJobs'],
    queryFn:  () => ridersApi.getAvailableJobs().then((r) => r.data.data),
    refetchInterval: riderProfile?.isOnline ? 15_000 : false,
    enabled:  riderProfile?.isOnline ?? false,
  })

  const toggleMutation = useMutation({
    mutationFn: (isOnline: boolean) => ridersApi.toggleOnline(isOnline).then((r) => r.data.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['riderProfile'] }),
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string }
      const msg = e?.response?.data?.message ?? e?.message ?? 'Something went wrong'
      toast.error(`Couldn't toggle online: ${msg}`)
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ridersApi.acceptJob(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riderJobs'] })
      qc.invalidateQueries({ queryKey: ['riderActiveOrder'] })
      qc.invalidateQueries({ queryKey: ['riderProfile'] })
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string }
      const status = e?.response?.status
      if (status === 409) {
        void qc.invalidateQueries({ queryKey: ['riderJobs'] })
        toast.warning('Job taken — another rider accepted it first.')
      } else {
        // Refetch first — accept may have succeeded despite the 500
        void qc.fetchQuery({ queryKey: ['riderActiveOrder'], queryFn: () => ridersApi.getActiveJob().then((r) => r.data.data ?? null) })
          .then((activeOrder) => {
            if (activeOrder) {
              // Accept worked — just refresh the list silently
              void qc.invalidateQueries({ queryKey: ['riderJobs'] })
              return
            }
            const msg = e?.response?.data?.message ?? e?.message ?? 'Try again'
            toast.error(`Couldn't accept job: ${msg}`)
          })
          .catch(() => {
            const msg = e?.response?.data?.message ?? e?.message ?? 'Try again'
            toast.error(`Couldn't accept job: ${msg}`)
          })
      }
    },
  })

  const isOnline      = riderProfile?.isOnline ?? false
  const availableJobs = ordersData ?? []

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean).map((n) => n![0]).join('').toUpperCase() || '?'

  useEffect(() => {
    if (isOnline) startRiderLocationTracking()
    else stopRiderLocationTracking()
  }, [isOnline])

  // ── Sticky header + list ─────────────────────────────────────────────────
  const ListHeader = (
    <>
      {/* ── App bar ───────────────────────────────────────────── */}
      <View style={s.appBar}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.name}>{user?.firstName ?? 'Rider'}</Text>
        </View>
        {riderProfile && (
          <View style={[s.statusPill, isOnline ? s.statusPillOnline : s.statusPillOffline]}>
            {isOnline && <PulseDot />}
            <Text style={[s.statusPillText, isOnline ? s.statusPillTextOnline : s.statusPillTextOffline]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Online / offline status card ──────────────────────── */}
      {profileLoading ? (
        <View style={[s.statusCard, { backgroundColor: COLORS.bg }]}>
          <View style={{ gap: SPACING.sm }}>
            <Skeleton width={120} height={13} borderRadius={6} />
            <Skeleton width={200} height={10} borderRadius={5} />
          </View>
          <Skeleton width={110} height={44} borderRadius={RADIUS.full} />
        </View>
      ) : isOnline ? (
        <View style={[s.statusCard, s.statusCardOnline]}>
          <View>
            <Text style={s.statusCardTitle}>You're online</Text>
            <Text style={s.statusCardSub}>New jobs will appear below automatically.</Text>
          </View>
          <Pressable
            style={s.goOfflineBtn}
            onPress={() => toggleMutation.mutate(false)}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending
              ? <ActivityIndicator color={COLORS.success} size="small" />
              : <Text style={s.goOfflineBtnText}>Go Offline</Text>
            }
          </Pressable>
        </View>
      ) : (
        <View style={[s.statusCard, s.statusCardOffline]}>
          <View>
            <Text style={[s.statusCardTitle, { color: '#fff' }]}>You're offline</Text>
            <Text style={[s.statusCardSub, { color: 'rgba(255,255,255,0.65)' }]}>
              Go online to start receiving delivery jobs.
            </Text>
          </View>
          <Pressable
            style={s.goOnlineBtn}
            onPress={() => toggleMutation.mutate(true)}
            disabled={toggleMutation.isPending}
          >
            {toggleMutation.isPending
              ? <ActivityIndicator color="#1C1C1E" size="small" />
              : <Text style={s.goOnlineBtnText}>Go Online</Text>
            }
          </Pressable>
        </View>
      )}

      {/* ── Quick stats ───────────────────────────────────────── */}
      {profileLoading ? (
        <View style={s.statsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.statCard}>
              <Skeleton width={34} height={34} borderRadius={10} style={{ marginBottom: SPACING.sm }} />
              <Skeleton width={44} height={13} borderRadius={6} style={{ marginBottom: 5 }} />
              <Skeleton width={36} height={9} borderRadius={4} />
            </View>
          ))}
        </View>
      ) : riderProfile ? (
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: COLORS.primaryFade }]}>
              <Ionicons name="bicycle" size={18} color={COLORS.primary} />
            </View>
            <Text style={s.statValue}>{riderProfile.totalDeliveries ?? 0}</Text>
            <Text style={s.statLabel}>Deliveries</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="star" size={18} color={COLORS.warning} />
            </View>
            <Text style={s.statValue}>{(riderProfile.rating ?? 0).toFixed(1)}</Text>
            <Text style={s.statLabel}>Rating</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: COLORS.successFade }]}>
              <Ionicons name="wallet" size={18} color={COLORS.success} />
            </View>
            <Text style={s.statValue}>{formatMoney(riderProfile.earnings?.pendingKobo ?? 0)}</Text>
            <Text style={s.statLabel}>Pending</Text>
          </View>
        </View>
      ) : null}

      {/* ── Section header for jobs list ──────────────────────── */}
      {isOnline && !ordersLoading && availableJobs.length > 0 && (
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Available Jobs</Text>
          <View style={s.jobCountBadge}>
            <Text style={s.jobCountText}>{availableJobs.length}</Text>
          </View>
        </View>
      )}
    </>
  )

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {!isOnline && !profileLoading ? (
        // Offline: no list needed, just header + offline state
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="moon" size={32} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>Ready when you are</Text>
              <Text style={s.emptyBody}>Tap "Go Online" above to start receiving delivery jobs.</Text>
            </View>
          }
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : ordersLoading ? (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={<JobsSkeleton />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : availableJobs.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={null}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="search" size={32} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>Looking for orders…</Text>
              <Text style={s.emptyBody}>Stay online — new jobs appear here the moment they're dispatched.</Text>
            </View>
          }
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={availableJobs}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <JobCard
              order={item}
              onAccept={() => acceptMutation.mutate(item._id)}
              accepting={acceptMutation.isPending && acceptMutation.variables === item._id}
            />
          )}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: COLORS.surfaceHighlight,
    paddingTop:      Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  listContent: { paddingBottom: 40 },

  // App bar
  appBar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.lg,
    backgroundColor:   COLORS.bg,
  },
  avatarWrap: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText:  { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },
  greeting:    { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  name:        { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.full,
  },
  statusPillOnline:       { backgroundColor: COLORS.successFade },
  statusPillOffline:      { backgroundColor: COLORS.surfaceHighlight },
  statusPillText:         { fontSize: FONT.xs, fontFamily: FONTS.semibold },
  statusPillTextOnline:   { color: COLORS.success },
  statusPillTextOffline:  { color: COLORS.textSecondary },

  // Status card
  statusCard: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginHorizontal:  SPACING.lg,
    marginBottom:      SPACING.md,
    marginTop:         2,
    borderRadius:      RADIUS.lg,
    padding:           SPACING.lg,
    gap:               SPACING.md,
    ...SHADOW.sm,
  },
  statusCardOnline:  { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.success + '30' },
  statusCardOffline: { backgroundColor: '#1C1C1E' },
  statusCardTitle:   { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statusCardSub:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 3 },

  goOnlineBtn: {
    backgroundColor: COLORS.success,
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minWidth:        110,
    alignItems:      'center',
  },
  goOnlineBtnText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: '#1C1C1E' },

  goOfflineBtn: {
    borderWidth:     1.5,
    borderColor:     COLORS.success,
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minWidth:        110,
    alignItems:      'center',
  },
  goOfflineBtnText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.success },

  // Stats row
  statsRow: {
    flexDirection:     'row',
    gap:               SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.lg,
  },
  statCard: {
    flex:            1,
    backgroundColor: COLORS.bg,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.md,
    alignItems:      'center',
    gap:             5,
    ...SHADOW.sm,
  },
  statIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statLabel: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  // Section header
  sectionHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.sm,
  },
  sectionTitle:  { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  jobCountBadge: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.full,
    minWidth:        22,
    height:          22,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 6,
  },
  jobCountText: { fontSize: FONT.xs, fontFamily: FONTS.bold, color: '#fff' },

  // Empty state
  emptyState: {
    alignItems:     'center',
    paddingTop:     SPACING.xxxl,
    paddingHorizontal: SPACING.xxxl,
    gap:            SPACING.md,
  },
  emptyIconWrap: {
    width:           68,
    height:          68,
    borderRadius:    22,
    backgroundColor: COLORS.bg,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.sm,
  },
  emptyTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  emptyBody:  { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
})

// ── Job card styles ───────────────────────────────────────────────────────────
const j = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bg,
    borderRadius:    RADIUS.lg,
    marginHorizontal: SPACING.lg,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    padding:        SPACING.lg,
    paddingBottom:  SPACING.md,
  },
  topLeft:       { gap: SPACING.sm },
  orderNum:      { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  statusChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    alignSelf:       'flex-start',
    borderRadius:    RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: FONT.xs, fontFamily: FONTS.semibold },
  earningsBox: { alignItems: 'flex-end', gap: 2 },
  earningsLabel: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  earningsAmount:{ fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.success },

  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg },

  details: { padding: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  detailIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1, fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },

  acceptBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             SPACING.sm,
    margin:          SPACING.lg,
    marginTop:       SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.full,
    paddingVertical: SPACING.md + 2,
  },
  acceptBtnText: { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },
})
