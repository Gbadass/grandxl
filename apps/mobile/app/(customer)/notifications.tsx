import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi } from '@grandxl/api-client'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { useAuthStore } from '../../src/store/auth.store'
import { COLORS, SPACING, RADIUS, FONT, FONTS } from '../../src/theme'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

// Each order status maps to a human-readable notification
const STATUS_NOTIF: Record<OrderStatus, {
  title: string
  body: (orderNumber: string) => string
  icon: IoniconsName
  color: string
  bg: string
}> = {
  [OrderStatus.PENDING]: {
    title: 'Order placed',
    body: (n) => `Order ${n} has been placed and is awaiting confirmation.`,
    icon: 'time-outline',
    color: COLORS.warning,
    bg: 'rgba(245,158,11,0.1)',
  },
  [OrderStatus.CONFIRMED]: {
    title: 'Order confirmed',
    body: (n) => `${n} has been confirmed by the restaurant.`,
    icon: 'checkmark-circle-outline',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
  },
  [OrderStatus.PREPARING]: {
    title: 'Being prepared',
    body: (n) => `The kitchen is preparing your order ${n}.`,
    icon: 'restaurant-outline',
    color: COLORS.primary,
    bg: COLORS.primaryFade,
  },
  [OrderStatus.READY]: {
    title: 'Food is ready',
    body: (n) => `Order ${n} is ready — waiting for a rider to pick it up.`,
    icon: 'bag-check-outline',
    color: COLORS.success,
    bg: 'rgba(34,197,94,0.1)',
  },
  [OrderStatus.PICKED_UP]: {
    title: 'Rider on the way',
    body: (n) => `Your order ${n} has been picked up and is heading to you.`,
    icon: 'bicycle-outline',
    color: COLORS.primary,
    bg: COLORS.primaryFade,
  },
  [OrderStatus.DELIVERED]: {
    title: 'Order delivered',
    body: (n) => `${n} has been delivered. Enjoy your meal!`,
    icon: 'checkmark-done-circle-outline',
    color: COLORS.success,
    bg: 'rgba(34,197,94,0.1)',
  },
  [OrderStatus.CANCELLED]: {
    title: 'Order cancelled',
    body: (n) => `Order ${n} was cancelled.`,
    icon: 'close-circle-outline',
    color: COLORS.error,
    bg: 'rgba(239,68,68,0.1)',
  },
}

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function NotifCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const cfg = STATUS_NOTIF[order.status as OrderStatus]
  if (!cfg) return null

  const isUnread = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.PICKED_UP,
  ].includes(order.status as OrderStatus)

  return (
    <Pressable style={[s.card, isUnread && s.cardUnread]} onPress={onPress}>
      {/* Icon bubble */}
      <View style={[s.iconBubble, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={s.cardContent}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle}>{cfg.title}</Text>
          <Text style={s.cardTime}>{timeAgo(order.updatedAt ?? order.createdAt)}</Text>
        </View>
        <Text style={s.cardBody} numberOfLines={2}>
          {cfg.body(order.orderNumber ?? `#${(order._id as string).slice(-6).toUpperCase()}`)}
        </Text>
        <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
          <Text style={[s.statusPillText, { color: cfg.color }]}>{order.status.replace('_', ' ')}</Text>
        </View>
      </View>

      {/* Unread dot */}
      {isUnread && <View style={s.unreadDot} />}
    </Pressable>
  )
}

export default function NotificationsScreen() {
  const router = useRouter()
  const user   = useAuthStore((s) => s.user)

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', 'orders'],
    queryFn: () => ordersApi.getHistory({ limit: 30, page: 1 }),
    enabled: !!user,
    staleTime: 30_000,
  })

  const orders = (data?.data?.data?.data ?? []) as Order[]

  // Sort: active orders first, then by most recent
  const sorted = [...orders].sort((a, b) => {
    const activeStatuses = new Set([
      OrderStatus.PENDING, OrderStatus.CONFIRMED,
      OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP,
    ])
    const aActive = activeStatuses.has(a.status as OrderStatus)
    const bActive = activeStatuses.has(b.status as OrderStatus)
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
  })

  const activeCount = sorted.filter(o =>
    [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.PICKED_UP]
      .includes(o.status as OrderStatus)
  ).length

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {activeCount > 0 && (
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>{activeCount} active</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.center}>
          <View style={s.skeletonWrap}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={s.skeleton}>
                <View style={s.skeletonIcon} />
                <View style={s.skeletonLines}>
                  <View style={[s.skeletonLine, { width: '60%' }]} />
                  <View style={[s.skeletonLine, { width: '85%', marginTop: 6 }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : sorted.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={40} color={COLORS.textTertiary} />
          </View>
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptySub}>Order something and we'll keep you posted here</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id as string}
          renderItem={({ item }) => (
            <NotifCard
              order={item}
              onPress={() => router.push(`/(customer)/orders/${item._id}` as never)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FONT.xl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: COLORS.primaryFade,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  headerBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.primary,
  },

  list: { padding: SPACING.lg, paddingBottom: 40 },
  separator: { height: SPACING.sm },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: {
    borderColor: COLORS.primary + '30',
    backgroundColor: COLORS.primaryFade + '80',
  },
  iconBubble: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: FONT.md,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  cardTime: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textTertiary,
  },
  cardBody: {
    fontSize: FONT.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: FONTS.semibold,
    textTransform: 'capitalize',
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 12, right: 12,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary, marginBottom: 6 },
  emptySub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },

  skeletonWrap: { width: '100%', gap: SPACING.md },
  skeleton: {
    flexDirection: 'row', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  skeletonIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.surfaceHighlight,
  },
  skeletonLines: { flex: 1, justifyContent: 'center' },
  skeletonLine: {
    height: 12, borderRadius: 6,
    backgroundColor: COLORS.surfaceHighlight,
  },
})
