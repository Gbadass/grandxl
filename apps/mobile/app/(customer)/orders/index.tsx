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
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../src/store/auth.store'
import { useCartStore } from '../../../src/store/cart.store'
import { toast } from '../../../src/lib/toast'
import { confirm } from '../../../src/lib/confirm'
import type { Order, CartItem } from '@grandxl/types'
import { OrderStatus } from '@grandxl/types'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../../src/theme'
import { BackButton } from '../../../src/components/BackButton'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  [OrderStatus.PENDING]:    { label: 'Pending',    color: COLORS.warning,   bg: 'rgba(245,158,11,0.1)' },
  [OrderStatus.CONFIRMED]:  { label: 'Confirmed',  color: '#3B82F6',        bg: 'rgba(59,130,246,0.1)' },
  [OrderStatus.PREPARING]:  { label: 'Preparing',  color: COLORS.primary,   bg: COLORS.primaryFade },
  [OrderStatus.READY]:      { label: 'Ready',      color: COLORS.success,   bg: COLORS.successFade },
  [OrderStatus.PICKED_UP]:  { label: 'On the way', color: COLORS.primary,   bg: COLORS.primaryFade },
  [OrderStatus.DELIVERED]:  { label: 'Delivered',  color: COLORS.success,   bg: COLORS.successFade },
  [OrderStatus.CANCELLED]:  { label: 'Cancelled',  color: COLORS.error,     bg: COLORS.errorFade },
}

const ACTIVE_STATUSES = new Set<OrderStatus>([
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
])

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: COLORS.textSecondary, bg: COLORS.surfaceHighlight }
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

function OrderCard({ order, onPress, onReorder }: {
  order: Order
  onPress: () => void
  onReorder?: () => void
}) {
  const isActive = ACTIVE_STATUSES.has(order.status as OrderStatus)
  const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0)
  const firstName = (order.items[0]?.name ?? 'Your order').split(' ').slice(0, 3).join(' ')
  const canReorder = order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED

  return (
    <Pressable style={[s.card, isActive && s.cardActive]} onPress={onPress}>
      {isActive && (
        <View style={s.activeBar}>
          <Ionicons name="flash" size={11} color="#fff" />
          <Text style={s.activeBarText}>Live order</Text>
        </View>
      )}
      <View style={s.cardBody}>
        <View style={s.cardLeft}>
          <Text style={s.orderNum}>{order.orderNumber}</Text>
          <Text style={s.orderSummary} numberOfLines={1}>
            {firstName}{itemCount > 1 ? ` + ${itemCount - 1} more` : ''}
          </Text>
          <Text style={s.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <View style={s.cardRight}>
          <StatusBadge status={order.status as OrderStatus} />
          <Text style={s.orderTotal}>{formatMoney(order.pricing.total)}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
        </View>
      </View>
      {canReorder && onReorder && (
        <View style={s.reorderRow}>
          <Pressable style={s.reorderBtn} onPress={onReorder} hitSlop={6}>
            <Ionicons name="repeat" size={14} color={COLORS.primary} />
            <Text style={s.reorderBtnText}>Reorder</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  )
}

function SkeletonCard() {
  return (
    <View style={[s.card, { gap: SPACING.sm }]}>
      <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: COLORS.surfaceHighlight }} />
      <View style={{ width: '65%', height: 11, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight }} />
      <View style={{ width: '30%', height: 11, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight }} />
    </View>
  )
}

export default function OrdersScreen() {
  const router = useRouter()
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  const fromProfile = ref === 'profile'
  const { isAuthenticated } = useAuthStore()
  const { addItem, clearCart, restaurantId: cartRestId, items: cartItems } = useCartStore()

  const reorder = async (order: Order) => {
    const restaurantId = order.restaurantId
    // If cart has items from a different restaurant, warn before clearing.
    if (cartRestId && cartRestId !== restaurantId && cartItems.length > 0) {
      const ok = await confirm({
        title:        'Replace cart?',
        message:      'Reordering will clear your current cart and add these items.',
        confirmLabel: 'Replace',
        variant:      'destructive',
        icon:         'warning',
      })
      if (!ok) return
      clearCart()
    }

    for (const item of order.items) {
      const cartItem: CartItem = {
        menuItemId:       item.menuItemId,
        restaurantId,
        name:             item.name,
        image:            item.image,
        basePrice:        item.basePrice,
        quantity:         item.quantity,
        selectedVariants: item.selectedVariants,
        selectedAddOns:   item.selectedAddOns,
        itemTotal:        item.itemTotal,
        note:             item.note,
      }
      addItem(cartItem)
    }
    toast.success(`Added ${order.items.length} item${order.items.length === 1 ? '' : 's'} to your cart`)
    router.push('/(customer)/cart' as never)
  }

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn:  () => ordersApi.getHistory({ limit: 50 }).then((r) => r.data.data.data),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View style={s.header}>
          {fromProfile ? <BackButton onPress={() => router.navigate('/(customer)/profile' as never)} /> : <View style={{ width: 40 }} />}
          <Text style={s.headerTitle}>Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.guestWrap}>
          <View style={s.guestIconWrap}>
            <Ionicons name="receipt-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={s.guestTitle}>Sign in to see your orders</Text>
          <Text style={s.guestSub}>
            Your active and past orders will show up here.
          </Text>
          <Pressable
            style={s.signInBtn}
            onPress={() => router.push('/(auth)/login' as never)}
          >
            <Text style={s.signInBtnText}>Sign in</Text>
          </Pressable>
          <Pressable
            style={s.createBtn}
            onPress={() => router.push('/(auth)/register' as never)}
          >
            <Text style={s.createBtnText}>Create an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const orders = data ?? []
  const active  = orders.filter((o) => ACTIVE_STATUSES.has(o.status as OrderStatus))
  const past    = orders.filter((o) => !ACTIVE_STATUSES.has(o.status as OrderStatus))

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        {fromProfile ? <BackButton onPress={() => router.navigate('/(customer)/profile' as never)} /> : <View style={{ width: 40 }} />}
        <Text style={s.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={s.skeletonWrap}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : orders.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🧾</Text>
          <Text style={s.emptyTitle}>No orders yet</Text>
          <Text style={s.emptySubtitle}>Your order history will appear here once you place your first order.</Text>
          <Pressable style={s.browseBtn} onPress={() => router.replace('/(customer)/' as never)}>
            <Text style={s.browseBtnText}>Browse Restaurants</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={[...active, ...past]}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/(customer)/orders/${item._id}` as never)}
              onReorder={() => void reorder(item)}
            />
          )}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            active.length > 0 ? (
              <View style={s.sectionHeader}>
                <View style={s.activeDot} />
                <Text style={s.sectionHeaderText}>Active</Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  guestWrap: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: SPACING.xxxl,
    gap:               0,
  },
  guestIconWrap: {
    width:           64,
    height:          64,
    borderRadius:    20,
    backgroundColor: COLORS.primaryFade,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.xl,
  },
  guestTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  guestSub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: SPACING.xxxl },
  signInBtn: {
    width:           '100%',
    height:          50,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACING.md,
  },
  signInBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },
  createBtn: {
    width:        '100%',
    height:       50,
    borderRadius: RADIUS.full,
    borderWidth:  1.5,
    borderColor:  COLORS.border,
    alignItems:   'center',
    justifyContent: 'center',
  },
  createBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical:   SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor:   COLORS.bg,
  },
  headerTitle: { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  skeletonWrap: { padding: SPACING.lg, gap: SPACING.md },

  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },

  sectionHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    marginBottom:    SPACING.md,
  },
  activeDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  sectionHeaderText:{ fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    RADIUS.md,
    overflow:        'hidden',
    ...SHADOW.sm,
  },
  cardActive: { borderWidth: 1.5, borderColor: COLORS.primary },
  activeBar: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical:   4,
  },
  activeBarText: { fontSize: FONT.xs, fontFamily: FONTS.semibold, color: '#fff' },
  cardBody: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    padding:           SPACING.md,
  },
  cardLeft:    { flex: 1, gap: 3 },
  cardRight:   { alignItems: 'flex-end', gap: SPACING.xs },
  orderNum:    { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  orderSummary:{ fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  orderDate:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  orderTotal:  { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.textPrimary },

  // Reorder action
  reorderRow: {
    borderTopWidth:    1,
    borderTopColor:    COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    alignItems:        'flex-end',
  },
  reorderBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   COLORS.primaryFade,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
  },
  reorderBtnText: { fontSize: FONT.xs, fontFamily: FONTS.bold, color: COLORS.primary },

  badge: {
    borderRadius:    RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  badgeText: { fontSize: FONT.xs, fontFamily: FONTS.semibold },

  emptyState: {
    flex:          1,
    alignItems:    'center',
    justifyContent:'center',
    gap:           SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIcon:     { fontSize: 60 },
  emptyTitle:    { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  browseBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius:    RADIUS.full,
    marginTop:       SPACING.sm,
  },
  browseBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },
})
