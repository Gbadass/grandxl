import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { restaurantsApi } from '@grandxl/api-client'
import type { Restaurant } from '@grandxl/types'
import { useCartStore } from '../../src/store/cart.store'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

const FOOD_PHOTOS = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=400&fit=crop&q=80',
  'https://images.unsplash.com/photo-1598514982641-e924c324d23a?w=600&h=400&fit=crop&q=80',
]

const CUISINES = [
  { label: 'All',       value: null },
  { label: 'Nigerian',  value: 'Nigerian' },
  { label: 'Chinese',   value: 'Chinese' },
  { label: 'Grills',    value: 'Grill' },
  { label: 'Fast Food', value: 'Fast Food' },
  { label: 'Pizza',     value: 'Pizza' },
  { label: 'Burgers',   value: 'Burgers' },
  { label: 'African',   value: 'African' },
]

const SORT_OPTIONS = [
  { id: 'rating',   label: 'Top rated' },
  { id: 'fastest',  label: 'Fastest' },
  { id: 'cheapest', label: 'Cheapest delivery' },
]

function placeholderColor(name: string) {
  const PALETTES = [
    { bg: '#FFF3E0', fg: '#E65100' },
    { bg: '#F3E5F5', fg: '#7B1FA2' },
    { bg: '#E8F5E9', fg: '#2E7D32' },
    { bg: '#E3F2FD', fg: '#1565C0' },
    { bg: '#FBE9E7', fg: '#BF360C' },
    { bg: '#E0F2F1', fg: '#00695C' },
    { bg: '#FEF3C7', fg: '#D97706' },
    { bg: '#FCE7F3', fg: '#DB2777' },
  ]
  const idx = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTES.length
  return PALETTES[idx]
}

function CardGradient() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
      <Defs>
        <LinearGradient id="browseCardGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.3" stopColor="#111114" stopOpacity="0" />
          <Stop offset="0.72" stopColor="#111114" stopOpacity="0.55" />
          <Stop offset="1"    stopColor="#111114" stopOpacity="0.88" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#browseCardGrad)" />
    </Svg>
  )
}

function SkeletonCard() {
  return (
    <View style={s.card}>
      <View style={[s.cardImage, { backgroundColor: COLORS.surfaceHighlight }]} />
      <View style={s.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <View style={{ width: '55%', height: 13, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight }} />
          <View style={{ width: 32, height: 13, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 56, height: 22, borderRadius: 6, backgroundColor: COLORS.surfaceHighlight }} />
          <View style={{ width: 56, height: 22, borderRadius: 6, backgroundColor: COLORS.surfaceHighlight }} />
          <View style={{ width: 72, height: 22, borderRadius: 6, backgroundColor: COLORS.surfaceHighlight }} />
        </View>
      </View>
    </View>
  )
}

function RestaurantCard({ item, index }: { item: Restaurant; index: number }) {
  const router   = useRouter()
  const [saved, setSaved] = useState(false)
  const palette  = placeholderColor(item.name)
  const photoUri = item.coverImage ?? item.logo ?? FOOD_PHOTOS[index % FOOD_PHOTOS.length]
  const isPopular = (item.rating ?? 0) >= 4.5
  const isFree = (item.deliveryFeeFixed ?? 0) === 0

  return (
    <Pressable style={s.card} onPress={() => router.push(`/restaurant/${item._id}` as never)}>
      {/* ── Image ── */}
      <View style={s.cardImageWrap}>
        <Image source={{ uri: photoUri }} style={s.cardImage} resizeMode="cover" />

        {/* Gradient overlay — sits above image */}
        <CardGradient />

        {/* Closed overlay */}
        {!item.isOpen && (
          <View style={s.closedOverlay}>
            <View style={s.closedPill}>
              <Text style={s.closedText}>Closed now</Text>
            </View>
          </View>
        )}

        {/* Top badges */}
        <View style={s.topBadges}>
          {isPopular && (
            <View style={s.popularBadge}>
              <Ionicons name="flame" size={10} color="#fff" />
              <Text style={s.popularBadgeText}>Popular</Text>
            </View>
          )}
          <View style={s.ratingBadge}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={s.ratingBadgeText}>{(item.rating ?? 0).toFixed(1)}</Text>
          </View>
        </View>

        {/* Heart — top left */}
        <Pressable onPress={() => setSaved(v => !v)} style={s.heartBtn} hitSlop={8}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={15} color={saved ? '#EF4444' : '#fff'} />
        </Pressable>

        {/* Bottom name + meta overlay */}
        <View style={s.imageFooter}>
          <View style={s.imageNameRow}>
            <Text style={s.imageName} numberOfLines={1}>{item.name}</Text>
            <View style={[s.statusDot, { backgroundColor: item.isOpen ? COLORS.success : COLORS.error }]} />
          </View>
          <Text style={s.imageCuisine} numberOfLines={1}>
            {item.cuisine?.slice(0, 3).join('  ·  ') ?? ''}
          </Text>
        </View>
      </View>

      {/* ── Below-image meta chips ── */}
      <View style={s.cardBody}>
        <View style={s.cardMeta}>
          <View style={s.metaChip}>
            <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
            <Text style={s.metaText}>{item.estimatedDeliveryTime} min</Text>
          </View>
          {isFree ? (
            <View style={[s.metaChip, s.freeChip]}>
              <Ionicons name="bicycle-outline" size={11} color="#059669" />
              <Text style={s.freeText}>Free delivery</Text>
            </View>
          ) : (
            <View style={s.metaChip}>
              <Ionicons name="bicycle-outline" size={11} color={COLORS.textSecondary} />
              <Text style={s.metaText}>₦{((item.deliveryFeeFixed ?? 0) / 100).toLocaleString('en-NG')}</Text>
            </View>
          )}
          {item.minOrderAmount > 0 && (
            <View style={s.metaChip}>
              <Text style={s.metaText}>Min ₦{(item.minOrderAmount / 100).toLocaleString('en-NG')}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}

export default function RestaurantsScreen() {
  const router = useRouter()
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))
  const [cuisine, setCuisine] = useState<string | null>(null)
  const [sortId, setSortId]   = useState('rating')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['restaurants', 'browse', cuisine],
    queryFn: () => restaurantsApi.getAll({ cuisine: cuisine ?? undefined, limit: 50, page: 1 }),
    // Poll so owner open/close toggles propagate without manual refresh.
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const all = (data?.data?.data?.data ?? []) as Restaurant[]

  const sorted = [...all].sort((a, b) => {
    if (sortId === 'fastest')  return a.estimatedDeliveryTime - b.estimatedDeliveryTime
    if (sortId === 'cheapest') return (a.deliveryFeeFixed ?? 0) - (b.deliveryFeeFixed ?? 0)
    return (b.rating ?? 0) - (a.rating ?? 0)
  })

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Restaurants</Text>
          {!isLoading && (
            <Text style={s.headerSub}>{all.length} place{all.length !== 1 ? 's' : ''} available</Text>
          )}
        </View>
        <Pressable style={s.cartBtn} onPress={() => router.push('/(customer)/cart' as never)} hitSlop={8}>
          <Ionicons name="cart-outline" size={22} color={COLORS.textPrimary} />
          {cartCount > 0 && (
            <View style={s.cartBadge}>
              <Text style={s.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Search bar — navigates to full search screen ── */}
      <Pressable style={s.searchWrap} onPress={() => router.push('/(customer)/search' as never)}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} style={s.searchIcon} />
        <Text style={s.searchPlaceholder}>Search restaurants or cuisine…</Text>
      </Pressable>

      {/* ── Filters section ── */}
      <View style={s.filtersSection}>
        {/* Sort row */}
        <View style={s.filterLabelRow}>
          <Ionicons name="swap-vertical-outline" size={12} color={COLORS.textTertiary} />
          <Text style={s.filterLabel}>Sort by</Text>
        </View>
        <FlatList
          data={SORT_OPTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(o) => o.id}
          contentContainerStyle={s.pillRow}
          renderItem={({ item: opt }) => {
            const active = sortId === opt.id
            return (
              <Pressable
                style={[s.pill, active && s.pillActive]}
                onPress={() => setSortId(opt.id)}
              >
                {active && <Ionicons name="checkmark" size={11} color={COLORS.primary} />}
                <Text style={[s.pillText, active && s.pillTextActive]}>{opt.label}</Text>
              </Pressable>
            )
          }}
        />

        <View style={s.filterDivider} />

        {/* Cuisine row */}
        <View style={s.filterLabelRow}>
          <Ionicons name="restaurant-outline" size={12} color={COLORS.textTertiary} />
          <Text style={s.filterLabel}>Cuisine</Text>
        </View>
        <FlatList
          data={CUISINES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.label}
          contentContainerStyle={s.pillRow}
          renderItem={({ item }) => {
            const active = cuisine === item.value
            return (
              <Pressable
                style={[s.pill, active && s.pillActive]}
                onPress={() => setCuisine(item.value)}
              >
                <Text style={[s.pillText, active && s.pillTextActive]}>{item.label}</Text>
              </Pressable>
            )
          }}
        />
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
          scrollEnabled={false}
        />
      ) : sorted.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="storefront-outline" size={36} color={COLORS.textTertiary} />
          </View>
          <Text style={s.emptyTitle}>No restaurants found</Text>
          <Text style={s.emptySub}>Try a different cuisine</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id as string}
          renderItem={({ item, index }) => <RestaurantCard item={item} index={index} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  headerTitle: { fontSize: FONT.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  headerSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 1 },
  cartBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: COLORS.bg,
  },
  cartBadgeText: { fontSize: 9, fontFamily: FONTS.bold, color: '#fff' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.full,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon:        { marginRight: SPACING.sm },
  searchPlaceholder: { flex: 1, fontSize: FONT.md, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  filtersSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    gap: 6,
  },
  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginVertical: 4,
  },
  pillRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceHighlight,
    minWidth: 64,
    justifyContent: 'center',
  },
  pillActive:     { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  pillText:       { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  pillTextActive: { color: COLORS.primary, fontFamily: FONTS.semibold },

  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xs },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', height: 168 },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  closedPill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  closedText: { color: '#fff', fontFamily: FONTS.semibold, fontSize: FONT.sm },

  topBadges: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  popularBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 4,
  },
  popularBadgeText: { fontSize: 9, fontFamily: FONTS.bold, color: '#fff' },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 4,
  },
  ratingBadgeText: { fontSize: FONT.xs, fontFamily: FONTS.bold, color: '#fff' },

  heartBtn: {
    position: 'absolute', top: 10, left: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  imageFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 12, gap: 3,
  },
  imageNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  imageName: {
    flex: 1, fontSize: 16, fontFamily: FONTS.bold, color: '#fff',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  imageCuisine: {
    fontSize: 11, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.78)',
  },

  cardBody: { paddingHorizontal: 12, paddingVertical: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 4,
  },
  metaText: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  freeChip: { backgroundColor: '#D1FAE5' },
  freeText: { fontSize: FONT.xs, fontFamily: FONTS.semibold, color: '#059669' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  emptySub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
})
