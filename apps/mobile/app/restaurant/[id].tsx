import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import { restaurantsApi } from '@grandxl/api-client'
import { menuApi } from '@grandxl/api-client'
import type { Restaurant, MenuCategory, MenuItem } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../../src/store/cart.store'
import { useFavorites } from '../../src/hooks/useFavorites'
import { COLORS, SPACING, RADIUS, FONTS } from '../../src/theme'

const { width: W } = Dimensions.get('window')
const COVER_H = 260

// ─── Gradient overlay on cover image ──────────────────────────────────────────

function CoverGradient() {
  return (
    <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
      <Defs>
        <LinearGradient id="coverGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.25" />
          <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverGrad)" />
    </Svg>
  )
}

// ─── Rating pill ──────────────────────────────────────────────────────────────

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={styles.ratingBadge}>
      <Ionicons name="star" size={11} color="#F59E0B" />
      <Text style={styles.ratingBadgeText}>{rating.toFixed(1)}</Text>
      <Text style={styles.ratingCount}>({count})</Text>
    </View>
  )
}

// ─── Menu item card ───────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  restaurantId,
  onAddPress,
  cartQty,
}: {
  item: MenuItem
  restaurantId: string
  onAddPress: (item: MenuItem) => void
  cartQty: number
}) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  const hasOptions = item.variants.length > 0 || item.addOns.length > 0

  function handleDecrement() {
    if (cartQty <= 1) {
      updateQuantity(item._id, 0)
    } else {
      updateQuantity(item._id, cartQty - 1)
    }
  }

  function handleIncrement() {
    if (hasOptions) {
      // Re-open sheet to pick options for additional quantity
      onAddPress(item)
    } else {
      updateQuantity(item._id, cartQty + 1)
    }
  }

  return (
    <Pressable style={styles.itemCard} onPress={() => onAddPress(item)}>
      <View style={styles.itemInfo}>
        {item.isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>⭐ Bestseller</Text>
          </View>
        )}
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.itemBottom}>
          <Text style={styles.itemPrice}>
            {formatMoney(item.basePrice, 'NGN')}
          </Text>
          {!item.isAvailable && (
            <Text style={styles.unavailableTag}>Unavailable</Text>
          )}
        </View>
      </View>

      <View style={styles.itemImageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
            <Ionicons name="fast-food-outline" size={26} color={COLORS.textTertiary} />
          </View>
        )}

        {item.isAvailable && (
          cartQty > 0 ? (
            <View style={styles.stepperWrap}>
              <Pressable
                style={styles.stepperBtn}
                onPress={(e) => { e.stopPropagation?.(); handleDecrement() }}
                hitSlop={6}
              >
                <Ionicons name="remove" size={14} color={COLORS.primary} />
              </Pressable>
              <Text style={styles.stepperQty}>{cartQty}</Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={(e) => { e.stopPropagation?.(); handleIncrement() }}
                hitSlop={6}
              >
                <Ionicons name="add" size={14} color={COLORS.primary} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.addBtn}
              onPress={() => onAddPress(item)}
              hitSlop={6}
            >
              <Ionicons name="add" size={18} color={COLORS.primary} />
            </Pressable>
          )
        )}
      </View>
    </Pressable>
  )
}

// ─── Add-to-cart bottom sheet ─────────────────────────────────────────────────

function AddToCartSheet({
  item,
  restaurantId,
  onClose,
}: {
  item: MenuItem | null
  restaurantId: string
  onClose: () => void
}) {
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, boolean>>({})

  if (!item) return null

  const addOnTotal = item.addOns
    .filter((a) => selectedAddOns[a.name])
    .reduce((sum, a) => sum + a.price, 0)

  const variantTotal = item.variants.reduce((sum, v) => {
    const chosen = v.options.find((o) => o.name === selectedVariants[v.name])
    return sum + (chosen?.priceAdjustment ?? 0)
  }, 0)

  const unitPrice = item.basePrice + variantTotal + addOnTotal
  const total = unitPrice * qty

  function handleAdd() {
    addItem({
      menuItemId: item!._id,
      restaurantId,
      name: item!.name,
      image: item!.image,
      basePrice: item!.basePrice,
      quantity: qty,
      selectedVariants: Object.entries(selectedVariants).map(([variantName, optionName]) => ({
        variantName,
        optionName,
        priceAdjustment: item!.variants
          .find((v) => v.name === variantName)
          ?.options.find((o) => o.name === optionName)?.priceAdjustment ?? 0,
      })),
      selectedAddOns: item!.addOns
        .filter((a) => selectedAddOns[a.name])
        .map((a) => ({ name: a.name, price: a.price })),
      itemTotal: total,
      note: note.trim() || null,
    })
    onClose()
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.sheetImage} resizeMode="cover" />
          )}
          <View style={styles.sheetBody}>
            <Text style={styles.sheetName}>{item.name}</Text>
            <Text style={styles.sheetDesc}>{item.description}</Text>
            <Text style={styles.sheetBasePrice}>{formatMoney(item.basePrice, 'NGN')}</Text>

            {/* Variants */}
            {item.variants.map((variant) => (
              <View key={variant.name} style={styles.sheetSection}>
                <View style={styles.sheetSectionHeader}>
                  <Text style={styles.sheetSectionTitle}>{variant.name}</Text>
                  {variant.isRequired && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>
                {variant.options.map((opt) => {
                  const selected = selectedVariants[variant.name] === opt.name
                  return (
                    <Pressable
                      key={opt.name}
                      style={styles.optionRow}
                      onPress={() =>
                        setSelectedVariants((prev) => ({ ...prev, [variant.name]: opt.name }))
                      }
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={styles.optionName}>{opt.name}</Text>
                      {opt.priceAdjustment > 0 && (
                        <Text style={styles.optionPrice}>
                          +{formatMoney(opt.priceAdjustment, 'NGN')}
                        </Text>
                      )}
                    </Pressable>
                  )
                })}
              </View>
            ))}

            {/* Add-ons */}
            {item.addOns.filter((a) => a.isAvailable).length > 0 && (
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>Add-ons</Text>
                {item.addOns.filter((a) => a.isAvailable).map((addOn) => {
                  const checked = !!selectedAddOns[addOn.name]
                  return (
                    <Pressable
                      key={addOn.name}
                      style={styles.optionRow}
                      onPress={() =>
                        setSelectedAddOns((prev) => ({ ...prev, [addOn.name]: !prev[addOn.name] }))
                      }
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <Text style={styles.optionName}>{addOn.name}</Text>
                      <Text style={styles.optionPrice}>+{formatMoney(addOn.price, 'NGN')}</Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* Note */}
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Add a note</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="E.g. no onions, extra spicy..."
                placeholderTextColor={COLORS.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={120}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.sheetFooter}>
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQty((q) => Math.max(1, q - 1))}
              hitSlop={8}
            >
              <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
            </Pressable>
            <Text style={styles.qtyText}>{qty}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQty((q) => q + 1)}
              hitSlop={8}
            >
              <Ionicons name="add" size={16} color={COLORS.textPrimary} />
            </Pressable>
          </View>
          <Pressable style={styles.addToCartBtn} onPress={handleAdd}>
            <Text style={styles.addToCartBtnText}>Add  ·  {formatMoney(total, 'NGN')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

// ─── Restaurant screen ────────────────────────────────────────────────────────

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const categoryBarRef = useRef<ScrollView>(null)

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [headerVisible, setHeaderVisible] = useState(false)

  const cartItems  = useCartStore((s) => s.items)
  const cartRestId = useCartStore((s) => s.restaurantId)
  const cartTotal  = cartItems.reduce((s, i) => s + i.itemTotal, 0)
  const cartCount  = cartItems.reduce((s, i) => s + i.quantity, 0)

  const { isFavorited, toggleFavorite } = useFavorites()
  const isFav = id ? isFavorited(id) : false
  const isThisCart = cartRestId === id

  const { data: restData, isLoading: restLoading } = useQuery({
    queryKey: ['restaurant', id],
    queryFn: () => restaurantsApi.getById(id),
    enabled: !!id,
  })

  const { data: catData, isLoading: catLoading } = useQuery({
    queryKey: ['menu-categories', id],
    queryFn: () => menuApi.getCategories(id),
    enabled: !!id,
  })

  const { data: itemData, isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items', id],
    queryFn: () => menuApi.getItems(id),
    enabled: !!id,
  })

  const restaurant  = restData?.data?.data as Restaurant | undefined
  const categories  = (catData?.data?.data ?? []) as MenuCategory[]
  const allItems    = (itemData?.data?.data?.items ?? []) as MenuItem[]

  const isLoading = restLoading || catLoading || itemsLoading

  const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat._id] = allItems.filter((i) => i.categoryId === cat._id && i.isAvailable !== false)
    return acc
  }, {})

  function getCartQty(itemId: string) {
    if (!isThisCart) return 0
    return cartItems.find((i) => i.menuItemId === itemId)?.quantity ?? 0
  }

  function scrollToCategory(catId: string, index: number) {
    setActiveCategory(catId)
    categoryBarRef.current?.scrollTo({ x: index * 110, animated: true })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textTertiary} />
        <Text style={styles.errorText}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const coverUri = restaurant.coverImage
    ?? 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=500&fit=crop&q=80'

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as keyof typeof restaurant.openingHours
  const todayHours = restaurant.openingHours[today]

  const cartItemLabel = cartCount === 1 ? '1 item' : `${cartCount} items`

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.floatingBack, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.floatingBackBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        {headerVisible && (
          <Text style={styles.floatingTitle} numberOfLines={1}>{restaurant.name}</Text>
        )}
        <Pressable
          style={styles.floatingBackBtn}
          hitSlop={8}
          onPress={() => id && toggleFavorite(id)}
        >
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={20}
            color={isFav ? '#EF4444' : '#fff'}
          />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setHeaderVisible(e.nativeEvent.contentOffset.y > COVER_H - 80)}
        scrollEventThrottle={16}
        stickyHeaderIndices={[2]}
      >
        {/* Cover image */}
        <View style={styles.cover}>
          <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
          <CoverGradient />
          {restaurant.logo && (
            <View style={styles.logoWrap}>
              <Image source={{ uri: restaurant.logo }} style={styles.logo} resizeMode="cover" />
            </View>
          )}
        </View>

        {/* Restaurant info */}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.restName}>{restaurant.name}</Text>
            <RatingBadge rating={restaurant.rating} count={restaurant.ratingCount} />
          </View>
          <Text style={styles.cuisine}>{restaurant.cuisine.join('  ·  ')}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.metaText}>{restaurant.estimatedDeliveryTime} mins</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="receipt-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.metaText}>
                Min {formatMoney(restaurant.minOrderAmount, restaurant.currency)}
              </Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={14} color={COLORS.textTertiary} />
              <Text style={styles.metaText}>
                {restaurant.deliveryFeeFixed === 0
                  ? 'Free delivery'
                  : formatMoney(restaurant.deliveryFeeFixed, restaurant.currency)}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: restaurant.isOpen ? COLORS.success : COLORS.error }]} />
            <Text style={[styles.statusText, { color: restaurant.isOpen ? COLORS.success : COLORS.error }]}>
              {restaurant.isOpen ? 'Open now' : 'Closed'}
            </Text>
            {todayHours?.isOpen && (
              <Text style={styles.hoursText}>  ·  {todayHours.open} – {todayHours.close}</Text>
            )}
          </View>
        </View>

        {/* Category tab bar (sticky) */}
        <View style={styles.catBarWrap}>
          <ScrollView
            ref={categoryBarRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catBar}
          >
            {categories.map((cat, idx) => {
              const active = activeCategory === cat._id || (activeCategory === null && idx === 0)
              return (
                <Pressable
                  key={cat._id}
                  style={[styles.catTab, active && styles.catTabActive]}
                  onPress={() => scrollToCategory(cat._id, idx)}
                >
                  <Text style={[styles.catTabText, active && styles.catTabTextActive]}>
                    {cat.name}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </View>

        {/* Menu sections */}
        <View style={{ paddingBottom: isThisCart && cartCount > 0 ? 100 : 40 }}>
          {categories.map((cat) => {
            const items = itemsByCategory[cat._id] ?? []
            if (items.length === 0) return null
            return (
              <View key={cat._id}>
                <View style={styles.catSection}>
                  <Text style={styles.catSectionTitle}>{cat.name}</Text>
                  {cat.description && (
                    <Text style={styles.catSectionDesc}>{cat.description}</Text>
                  )}
                </View>
                {items.map((item) => (
                  <MenuItemCard
                    key={item._id}
                    item={item}
                    restaurantId={id}
                    onAddPress={setSelectedItem}
                    cartQty={getCartQty(item._id)}
                  />
                ))}
              </View>
            )
          })}
          {categories.length === 0 && (
            <View style={styles.emptyMenu}>
              <Ionicons name="fast-food-outline" size={44} color={COLORS.textTertiary} />
              <Text style={styles.emptyMenuText}>Menu coming soon</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky cart bar */}
      {isThisCart && cartCount > 0 && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            style={styles.cartBarBtn}
            onPress={() => router.push('/(customer)/cart' as never)}
          >
            {/* Top-half gloss sheen */}
            <View style={styles.cartBarGloss} pointerEvents="none" />

            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{cartCount}</Text>
            </View>
            <Text style={styles.cartBarLabel}>View Cart</Text>
            <View style={styles.cartBarRight}>
              <Text style={styles.cartBarTotal}>{formatMoney(cartTotal, 'NGN')}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </View>
          </Pressable>
        </View>
      )}

      <AddToCartSheet
        item={selectedItem}
        restaurantId={id}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  errorScreen:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, gap: SPACING.md },
  errorText:     { fontSize: 16, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  backBtn:       { marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  backBtnText:   { color: '#fff', fontFamily: FONTS.bold, fontSize: 14 },

  floatingBack: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  floatingBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  floatingTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 16, color: '#fff', textAlign: 'center' },

  cover:      { height: COVER_H, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  logoWrap:   { position: 'absolute', bottom: -28, left: SPACING.lg, width: 60, height: 60, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 3, borderColor: '#fff' },
  logo:       { width: '100%', height: '100%' },

  infoBlock:  { paddingHorizontal: SPACING.lg, paddingTop: 40, paddingBottom: SPACING.lg, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  restName:   { flex: 1, fontSize: 22, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.4 },

  // Rating badge — dark/charcoal like Uber Eats, star in amber
  ratingBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1C1C1E', borderRadius: RADIUS.xs, paddingHorizontal: 9, paddingVertical: 5, marginTop: 3 },
  ratingBadgeText: { color: '#fff', fontFamily: FONTS.extrabold, fontSize: 13 },
  ratingCount:     { color: 'rgba(255,255,255,0.6)', fontFamily: FONTS.regular, fontSize: 11 },

  cuisine:    { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.sm },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  metaItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:   { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textTertiary },
  metaDot:    { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.border },
  statusRow:  { flexDirection: 'row', alignItems: 'center' },
  statusDot:  { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13, fontFamily: FONTS.semibold },
  hoursText:  { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  catBarWrap: { backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  catBar:     { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  catTab:     { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceHighlight },
  catTabActive: { backgroundColor: COLORS.primaryFade, borderWidth: 1.5, borderColor: COLORS.primary },
  catTabText: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary, textTransform: 'capitalize' },
  catTabTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },

  catSection:      { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.sm },
  catSectionTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.2, textTransform: 'capitalize' },
  catSectionDesc:  { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  itemCard:    { flexDirection: 'row', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.md, backgroundColor: COLORS.bg },
  itemInfo:    { flex: 1, gap: 4 },
  popularBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF7ED', borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 2 },
  popularText:  { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.primary },
  itemName:     { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.textPrimary, lineHeight: 20, textTransform: 'capitalize' },
  itemDesc:     { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 17 },
  itemBottom:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  itemPrice:    { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  unavailableTag: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.error },

  itemImageWrap:       { width: 96, height: 96, position: 'relative', justifyContent: 'flex-end', alignItems: 'flex-end' },
  itemImage:           { width: 96, height: 96, borderRadius: RADIUS.md, position: 'absolute', top: 0, left: 0 },
  itemImagePlaceholder:{ backgroundColor: COLORS.surfaceHighlight, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md },

  // Single "+" add button when qty = 0
  addBtn: {
    position: 'absolute',
    bottom: -8,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  // Inline stepper when qty > 0
  stepperWrap: {
    position: 'absolute',
    bottom: -10,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  stepperBtn: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  stepperQty: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.primary, minWidth: 14, textAlign: 'center' },

  emptyMenu:     { alignItems: 'center', paddingVertical: 60, gap: SPACING.md },
  emptyMenuText: { fontSize: 15, fontFamily: FONTS.medium, color: COLORS.textTertiary },

  // Cart bar — white tray with glossy primary pill inside
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    // Subtle upward shadow so it lifts off the content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  cartBarBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    // Very pale orange tint — clearly not orange, clearly not invisible
    backgroundColor: 'rgba(234, 88, 12, 0.07)',
    // Primary border ring — this is the "primary color radius"
    borderWidth: 2,
    borderColor: COLORS.primary,
    // Primary glow under the pill
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  // Brighter top strip — convex gloss illusion
  cartBarGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  cartCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  cartCountText: { fontSize: 13, fontFamily: FONTS.extrabold, color: '#fff' },
  cartBarLabel:  { flex: 1, fontSize: 15, fontFamily: FONTS.bold, color: COLORS.primary },
  cartBarRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBarTotal:  { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.primary },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:        { backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, maxHeight: '85%' },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SPACING.sm, marginBottom: SPACING.xs },
  sheetImage:   { width: '100%', height: 200, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl },
  sheetBody:    { padding: SPACING.lg, gap: SPACING.xs },
  sheetName:    { fontSize: 19, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.3 },
  sheetDesc:    { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18 },
  sheetBasePrice:{ fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  sheetSection: { marginTop: SPACING.lg, gap: SPACING.sm },
  sheetSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sheetSectionTitle:  { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  requiredBadge:{ backgroundColor: COLORS.errorFade, borderRadius: RADIUS.xs, paddingHorizontal: 7, paddingVertical: 2 },
  requiredText: { fontSize: 10, fontFamily: FONTS.semibold, color: COLORS.error },
  optionRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected:{ borderColor: COLORS.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  checkbox:     { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionName:   { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textPrimary },
  optionPrice:  { fontSize: 13, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  noteInput:    { backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textPrimary, minHeight: 72, textAlignVertical: 'top' },
  sheetFooter:  { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  qtyRow:       { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 8 },
  qtyBtn:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  qtyText:      { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.textPrimary, minWidth: 24, textAlign: 'center' },
  addToCartBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 15, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  addToCartBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
})
