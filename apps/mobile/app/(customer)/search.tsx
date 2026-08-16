import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  StatusBar,
  Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { restaurantsApi } from '@grandxl/api-client'
import type { Restaurant } from '@grandxl/types'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

function formatMoney(kobo: number) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const CATEGORIES: { label: string; value: string; icon: IoniconsName; bg: string; fg: string }[] = [
  { label: 'Jollof & Rice', value: 'rice',      icon: 'restaurant-outline',  bg: '#FEF3C7', fg: '#D97706' },
  { label: 'Burgers',       value: 'burgers',   icon: 'fast-food-outline',   bg: '#FFF7ED', fg: '#EA580C' },
  { label: 'Pizza',         value: 'pizza',     icon: 'pizza-outline',       bg: '#FEE2E2', fg: '#DC2626' },
  { label: 'Shawarma',      value: 'shawarma',  icon: 'restaurant-outline',  bg: '#ECFDF5', fg: '#059669' },
  { label: 'Chicken',       value: 'chicken',   icon: 'nutrition-outline',   bg: '#FEF9C3', fg: '#CA8A04' },
  { label: 'Pasta',         value: 'pasta',     icon: 'restaurant-outline',  bg: '#FFF1F2', fg: '#E11D48' },
  { label: 'Seafood',       value: 'seafood',   icon: 'fish-outline',        bg: '#EFF6FF', fg: '#1D4ED8' },
  { label: 'Suya & Grill',  value: 'grill',     icon: 'flame-outline',       bg: '#FDF4FF', fg: '#9333EA' },
  { label: 'Desserts',      value: 'desserts',  icon: 'ice-cream-outline',   bg: '#FCE7F3', fg: '#DB2777' },
  { label: 'Smoothies',     value: 'smoothies', icon: 'wine-outline',        bg: '#F0FDF4', fg: '#16A34A' },
]

const TRENDING = ['Jollof rice', 'Suya', 'Chicken burger', 'Fried rice', 'Shawarma', 'Small chops']
const RECENT_MAX = 6

// Deterministic pastel from restaurant name (matches browse page)
function placeholderColor(name: string) {
  const PALETTES = [
    { bg: '#FFF3E0', fg: '#E65100' },
    { bg: '#F3E5F5', fg: '#7B1FA2' },
    { bg: '#E8F5E9', fg: '#2E7D32' },
    { bg: '#E3F2FD', fg: '#1565C0' },
    { bg: '#FBE9E7', fg: '#BF360C' },
    { bg: '#E0F2F1', fg: '#00695C' },
  ]
  const idx = name.charCodeAt(0) % PALETTES.length
  return PALETTES[idx]
}

// ── Skeleton ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={s.resultCard}>
      <View style={[s.resultThumb, { backgroundColor: COLORS.surfaceHighlight }]} />
      <View style={s.resultBody}>
        <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: COLORS.surfaceHighlight, marginBottom: 7 }} />
        <View style={{ width: '38%', height: 11, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight, marginBottom: 10 }} />
        <View style={{ width: '75%', height: 11, borderRadius: 5, backgroundColor: COLORS.surfaceHighlight }} />
      </View>
    </View>
  )
}

// ── Result card ───────────────────────────────────────────────────

function ResultCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  const palette = placeholderColor(restaurant.name)
  const hasImage = !!(restaurant.coverImage ?? restaurant.logo)
  const cuisineLabel = restaurant.cuisine?.slice(0, 2).join(' · ') ?? ''

  return (
    <Pressable style={s.resultCard} onPress={onPress}>
      <View style={s.resultThumbWrap}>
        {hasImage ? (
          <Image
            source={{ uri: (restaurant.coverImage ?? restaurant.logo)! }}
            style={s.resultThumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.resultThumb, { backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 26, fontFamily: FONTS.bold, color: palette.fg, opacity: 0.75 }}>
              {restaurant.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {!restaurant.isOpen && (
          <View style={s.closedBadge}>
            <Text style={s.closedBadgeText}>Closed</Text>
          </View>
        )}
      </View>

      <View style={s.resultBody}>
        <View style={s.resultTopRow}>
          <Text style={s.resultName} numberOfLines={1}>{restaurant.name}</Text>
          <View style={s.ratingChip}>
            <Ionicons name="star" size={9} color="#fff" />
            <Text style={s.ratingChipText}>{(restaurant.rating ?? 0).toFixed(1)}</Text>
          </View>
        </View>
        {cuisineLabel ? (
          <Text style={s.resultCuisine} numberOfLines={1}>{cuisineLabel}</Text>
        ) : null}
        <View style={s.resultMeta}>
          <Ionicons name="time-outline" size={11} color={COLORS.textTertiary} />
          <Text style={s.metaText}>{restaurant.estimatedDeliveryTime} min</Text>
          <View style={s.metaDot} />
          {(restaurant.deliveryFeeFixed ?? 0) === 0 ? (
            <Text style={[s.metaText, { color: '#059669', fontFamily: FONTS.semibold }]}>Free delivery</Text>
          ) : (
            <>
              <Ionicons name="bicycle-outline" size={11} color={COLORS.textTertiary} />
              <Text style={s.metaText}>{formatMoney(restaurant.deliveryFeeFixed ?? 0)}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  )
}

// ── Category card ─────────────────────────────────────────────────

function CategoryCard({
  item,
  onPress,
}: {
  item: typeof CATEGORIES[number]
  onPress: () => void
}) {
  return (
    <Pressable style={[s.categoryCard, { backgroundColor: item.bg }]} onPress={onPress}>
      <View style={[s.categoryIconWrap, { backgroundColor: item.fg + '22' }]}>
        <Ionicons name={item.icon} size={26} color={item.fg} />
      </View>
      <Text style={[s.categoryLabel, { color: item.fg }]}>{item.label}</Text>
    </Pressable>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router   = useRouter()
  const inputRef = useRef<TextInput>(null)

  const [inputText,     setInputText]     = useState('')
  const [debouncedQ,    setDebouncedQ]    = useState('')
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(inputText.trim()), 320)
    return () => clearTimeout(t)
  }, [inputText])

  useEffect(() => {
    if (inputText.length > 0) setActiveCuisine(null)
  }, [inputText])

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () =>
      restaurantsApi.search(debouncedQ, {}).then((r) => r.data.data.restaurants),
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  })

  const { data: cuisineData, isLoading: cuisineLoading } = useQuery({
    queryKey: ['restaurants', 'cuisine', activeCuisine],
    queryFn: () =>
      restaurantsApi.getAll({ cuisine: activeCuisine!, limit: 50, page: 1 })
        .then((r) => (r.data?.data?.data ?? []) as Restaurant[]),
    enabled: !!activeCuisine && debouncedQ.length < 2,
    staleTime: 2 * 60_000,
  })

  const saveRecent = useCallback((q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    setRecentSearches((prev) => [trimmed, ...prev.filter((r) => r !== trimmed)].slice(0, RECENT_MAX))
  }, [])

  const handleSubmit = useCallback(() => {
    saveRecent(inputText)
    Keyboard.dismiss()
  }, [inputText, saveRecent])

  const handleRecentTap = useCallback((term: string) => {
    setInputText(term)
    setDebouncedQ(term)
    saveRecent(term)
  }, [saveRecent])

  const handleRestaurantPress = useCallback((id: string) => {
    saveRecent(inputText)
    router.push(`/restaurant/${id}` as never)
  }, [inputText, saveRecent, router])

  const selectCuisine = useCallback((value: string) => {
    setActiveCuisine(value)
    setInputText('')
    setDebouncedQ('')
    Keyboard.dismiss()
  }, [])

  const clearInput = useCallback(() => {
    setInputText('')
    setDebouncedQ('')
    setActiveCuisine(null)
    inputRef.current?.focus()
  }, [])

  const isSearchMode  = debouncedQ.length >= 2
  const isCuisineMode = !!activeCuisine && !isSearchMode
  const isLoading     = isSearchMode ? searchLoading : (isCuisineMode ? cuisineLoading : false)
  const results: Restaurant[] = isSearchMode
    ? (searchData ?? [])
    : isCuisineMode
      ? (cuisineData ?? [])
      : []

  const showResults = isSearchMode || isCuisineMode
  const activeCategory = CATEGORIES.find((c) => c.value === activeCuisine)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header — only visible when idle */}
      {!showResults && !inputText && (
        <View style={s.header}>
          <Text style={s.headerTitle}>Discover</Text>
          <Text style={s.headerSub}>What are you craving today?</Text>
        </View>
      )}

      {/* Back-to-idle button when in results mode */}
      {showResults && (
        <View style={s.resultsHeader}>
          <Pressable style={s.backBtn} onPress={clearInput} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={s.resultsHeading} numberOfLines={1}>
            {activeCategory ? activeCategory.label : `"${debouncedQ}"`}
          </Text>
        </View>
      )}

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} style={s.searchIcon} />
        <TextInput
          ref={inputRef}
          style={s.searchInput}
          placeholder="Restaurants, cuisines, dishes…"
          placeholderTextColor={COLORS.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {inputText.length > 0 && (
          <Pressable onPress={clearInput} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Cuisine chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipsScroll}
        contentContainerStyle={s.chipsRow}
      >
        {CATEGORIES.map((c) => {
          const active = activeCuisine === c.value
          return (
            <Pressable
              key={c.value}
              style={[s.chip, active && { borderColor: c.fg, backgroundColor: c.bg }]}
              onPress={() => active ? clearInput() : selectCuisine(c.value)}
            >
              <Ionicons name={c.icon} size={13} color={active ? c.fg : COLORS.textSecondary} />
              <Text style={[s.chipLabel, active && { color: c.fg, fontFamily: FONTS.semibold }]}>{c.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* ── Results pane ── */}
      {showResults ? (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : results.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="search-outline" size={34} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>No results found</Text>
              <Text style={s.emptySub}>
                {isSearchMode
                  ? `No restaurants match "${debouncedQ}"`
                  : 'No restaurants serve this cuisine yet'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.resultCount}>
                {results.length} restaurant{results.length !== 1 ? 's' : ''}
              </Text>
              {results.map((r) => (
                <ResultCard
                  key={r._id}
                  restaurant={r}
                  onPress={() => handleRestaurantPress(r._id)}
                />
              ))}
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Idle pane ── */
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Recent</Text>
                <Pressable hitSlop={8} onPress={() => setRecentSearches([])}>
                  <Text style={s.sectionAction}>Clear all</Text>
                </Pressable>
              </View>
              {recentSearches.map((term) => (
                <Pressable key={term} style={s.recentRow} onPress={() => handleRecentTap(term)}>
                  <View style={s.recentIcon}>
                    <Ionicons name="time-outline" size={15} color={COLORS.textTertiary} />
                  </View>
                  <Text style={s.recentTerm}>{term}</Text>
                  <Pressable
                    hitSlop={10}
                    onPress={() => setRecentSearches((prev) => prev.filter((r) => r !== term))}
                  >
                    <Ionicons name="close" size={14} color={COLORS.textTertiary} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          {/* Trending */}
          {recentSearches.length === 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Trending now</Text>
              <View style={s.trendingRow}>
                {TRENDING.map((term) => (
                  <Pressable
                    key={term}
                    style={s.trendingChip}
                    onPress={() => handleRecentTap(term)}
                  >
                    <Ionicons name="trending-up-outline" size={12} color={COLORS.primary} />
                    <Text style={s.trendingLabel}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Popular categories */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Popular categories</Text>
            <View style={s.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <CategoryCard
                  key={cat.value}
                  item={cat}
                  onPress={() => selectCuisine(cat.value)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.sm,
    paddingBottom:     SPACING.md,
  },
  headerTitle: { fontSize: FONT.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  headerSub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  resultsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop:     SPACING.sm,
    paddingBottom:  SPACING.md,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  resultsHeading: {
    flex: 1,
    fontSize: FONT.lg,
    fontFamily: FONTS.semibold,
    color: COLORS.textPrimary,
  },

  searchWrap: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   COLORS.surfaceHighlight,
    borderRadius:      RADIUS.full,
    marginHorizontal:  SPACING.lg,
    marginBottom:      SPACING.md,
    paddingHorizontal: SPACING.md,
    height:            46,
    borderWidth:       1,
    borderColor:       COLORS.border,
  },
  searchIcon:  { marginRight: SPACING.sm },
  searchInput: {
    flex: 1,
    fontSize: FONT.md,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },

  chipsScroll: { flexGrow: 0 },
  chipsRow: {
    paddingHorizontal: SPACING.lg,
    gap:               SPACING.sm,
    paddingBottom:     SPACING.md,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: SPACING.md,
    paddingVertical:   6,
    borderRadius:      RADIUS.full,
    borderWidth:       1.5,
    borderColor:       COLORS.border,
    backgroundColor:   COLORS.surface,
  },
  chipLabel: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, paddingTop: SPACING.xs },

  // Result count
  resultCount: {
    fontSize:     FONT.xs,
    fontFamily:   FONTS.regular,
    color:        COLORS.textTertiary,
    marginBottom: SPACING.md,
  },

  // Result card
  resultCard: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACING.md,
    paddingVertical:  SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  resultThumbWrap: { position: 'relative' },
  resultThumb: {
    width:        86,
    height:       76,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceHighlight,
  },
  closedBadge: {
    position:          'absolute',
    bottom:            4,
    left:              4,
    backgroundColor:   'rgba(0,0,0,0.65)',
    borderRadius:      RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  closedBadgeText: { color: '#fff', fontSize: 9, fontFamily: FONTS.semibold },

  resultBody:   { flex: 1, gap: 4 },
  resultTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  resultName:   { flex: 1, fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  ratingChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    backgroundColor:   COLORS.success,
    borderRadius:      RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  ratingChipText:  { fontSize: 9, fontFamily: FONTS.bold, color: '#fff' },
  resultCuisine:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  resultMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:        { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  metaDot:         { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.textTertiary },

  // Empty state
  emptyWrap: {
    alignItems:   'center',
    paddingTop:   SPACING.xxxl * 2,
    gap:          SPACING.md,
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: { fontSize: FONT.lg, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  emptySub:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },

  // Sections
  section: { marginBottom: SPACING.xxl },
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SPACING.sm,
  },
  sectionTitle:  { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  sectionAction: { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary },

  // Recent
  recentRow: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACING.md,
    paddingVertical:  13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  recentIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  recentTerm: { flex: 1, fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textPrimary },

  // Trending
  trendingRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    marginTop:     SPACING.sm,
  },
  trendingChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: SPACING.md,
    paddingVertical:   7,
    borderRadius:      RADIUS.full,
    backgroundColor:   COLORS.primaryFade,
    borderWidth:       1,
    borderColor:       'rgba(249,115,22,0.2)',
  },
  trendingLabel: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.primary },

  // Categories
  categoryGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.md,
    marginTop:     SPACING.md,
  },
  categoryCard: {
    width:          '47%',
    paddingVertical: SPACING.lg,
    borderRadius:   RADIUS.lg,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            SPACING.sm,
    ...SHADOW.sm,
  },
  categoryIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  categoryLabel: { fontSize: FONT.sm, fontFamily: FONTS.semibold, textAlign: 'center' },
})
