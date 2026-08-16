import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  Linking,
  TextInput,
  Switch,
  Modal,
} from 'react-native'
import { confirm } from '../../src/lib/confirm'
import { toast } from '../../src/lib/toast'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useNavigation } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useCartStore } from '../../src/store/cart.store'
import { useAuthStore } from '../../src/store/auth.store'
import { usersApi, restaurantsApi, ordersApi, paymentsApi, couponsApi, walletApi } from '@grandxl/api-client'
import { PaymentMethod } from '@grandxl/types'
import type { Address, CartItem } from '@grandxl/types'
import { COLORS, SPACING, RADIUS, FONT, FONTS, SHADOW } from '../../src/theme'

const TIP_PRESETS_KOBO = [0, 200_00, 500_00, 1000_00]

const SERVICE_FEE_RATE = 0.05
const SERVICE_FEE_CAP  = 150_000

function formatMoney(kobo: number): string {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Cart item row ──────────────────────────────────────────────────

function CartItemRow({ item, onIncrease, onDecrease }: {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
}) {
  const unitPrice = item.itemTotal / item.quantity

  return (
    <View style={s.itemRow}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={s.itemImage} resizeMode="cover" />
      ) : (
        <View style={[s.itemImage, s.itemImageFallback]}>
          <Ionicons name="fast-food-outline" size={22} color={COLORS.textTertiary} />
        </View>
      )}

      <View style={s.itemInfo}>
        <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
        {item.selectedVariants.length > 0 && (
          <Text style={s.itemMeta} numberOfLines={1}>
            {item.selectedVariants.map((v) => v.optionName).join(', ')}
          </Text>
        )}
        {item.selectedAddOns.length > 0 && (
          <Text style={s.itemMeta} numberOfLines={1}>
            + {item.selectedAddOns.map((a) => a.name).join(', ')}
          </Text>
        )}
        <Text style={s.itemPrice}>{formatMoney(unitPrice)}</Text>
      </View>

      {/* Swiggy-style pill stepper */}
      <View style={s.stepper}>
        <Pressable style={s.stepperBtn} onPress={onDecrease} hitSlop={6}>
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={14}
            color={item.quantity === 1 ? COLORS.error : COLORS.primary}
          />
        </Pressable>
        <Text style={s.stepperQty}>{item.quantity}</Text>
        <Pressable style={s.stepperBtn} onPress={onIncrease} hitSlop={6}>
          <Ionicons name="add" size={14} color={COLORS.primary} />
        </Pressable>
      </View>
    </View>
  )
}

// ── Address selector ───────────────────────────────────────────────

function AddressSelector({ addresses, selectedId, onSelect }: {
  addresses: Address[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const router = useRouter()

  if (addresses.length === 0) {
    return (
      <Pressable style={s.addAddressBtn} onPress={() => router.push('/(customer)/profile/addresses' as never)}>
        <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
        <Text style={s.addAddressBtnText}>Add a delivery address</Text>
      </Pressable>
    )
  }

  return (
    <View style={s.addressList}>
      {addresses.map((addr) => {
        const isSelected = addr._id === selectedId
        return (
          <Pressable
            key={addr._id}
            style={[s.addressCard, isSelected && s.addressCardSelected]}
            onPress={() => onSelect(addr._id)}
          >
            <View style={[s.addressIconWrap, isSelected && s.addressIconWrapSelected]}>
              <Ionicons name="location-outline" size={16} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
            </View>
            <View style={s.addressCardBody}>
              <Text style={s.addressLabel}>{addr.label}</Text>
              <Text style={s.addressStreet} numberOfLines={2}>
                {addr.street}, {addr.city}, {addr.state}
              </Text>
              {addr.instructions ? (
                <Text style={s.addressInstructions} numberOfLines={1}>{addr.instructions}</Text>
              ) : null}
            </View>
            <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
              {isSelected && <View style={s.radioInner} />}
            </View>
          </Pressable>
        )
      })}
      <Pressable style={s.addAnotherBtn} onPress={() => router.push('/(customer)/profile/addresses' as never)}>
        <Ionicons name="add" size={14} color={COLORS.primary} />
        <Text style={s.addAnotherBtnText}>Add another address</Text>
      </Pressable>
    </View>
  )
}

// ── Payment selector ───────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  {
    method: PaymentMethod.CASH,
    icon:   'cash-outline' as const,
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    label: 'Cash on Delivery',
    desc:  'Pay the rider when your order arrives',
  },
  {
    method: PaymentMethod.PAYSTACK,
    icon:   'card-outline' as const,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    label: 'Pay with Paystack',
    desc:  'Debit/credit card via Paystack',
  },
  {
    method: PaymentMethod.WALLET,
    icon:   'wallet-outline' as const,
    iconBg: COLORS.primaryFade,
    iconColor: COLORS.primary,
    label: 'GrandXL Wallet',
    desc:  'Pay using your wallet balance',
  },
]

function PaymentSelector({ selected, onSelect }: {
  selected: PaymentMethod
  onSelect: (m: PaymentMethod) => void
}) {
  return (
    <View style={s.paymentList}>
      {PAYMENT_OPTIONS.map((opt) => {
        const isSelected = opt.method === selected
        return (
          <Pressable
            key={opt.method}
            style={[s.paymentCard, isSelected && s.paymentCardSelected]}
            onPress={() => onSelect(opt.method)}
          >
            <View style={[s.paymentIconWrap, { backgroundColor: opt.iconBg }]}>
              <Ionicons name={opt.icon} size={18} color={opt.iconColor} />
            </View>
            <View style={s.paymentCardBody}>
              <Text style={[s.paymentLabel, isSelected && s.paymentLabelSelected]}>{opt.label}</Text>
              <Text style={s.paymentDesc}>{opt.desc}</Text>
            </View>
            <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
              {isSelected && <View style={s.radioInner} />}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Schedule picker ────────────────────────────────────────────────

function SchedulePicker({ visible, onClose, onPick }: {
  visible: boolean
  onClose: () => void
  onPick: (d: Date) => void
}) {
  const today = new Date()
  // 7 days of options. Backend rejects anything < 60 min ahead, so today's slots
  // start at max(now + 1h, 09:00) and run through 22:00 in 30-min steps.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const [activeDay, setActiveDay] = useState(0)

  const slots = useMemo(() => {
    const day = days[activeDay]
    const earliestToday = new Date(Date.now() + 60 * 60 * 1000) // +60 min
    const result: Date[] = []
    for (let h = 9; h < 22; h++) {
      for (const m of [0, 30]) {
        const slot = new Date(day)
        slot.setHours(h, m, 0, 0)
        if (activeDay === 0 && slot < earliestToday) continue
        result.push(slot)
      }
    }
    return result
  }, [days, activeDay])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scheduleBackdrop} onPress={onClose}>
        <Pressable style={s.scheduleSheet} onPress={() => undefined}>
          <View style={s.scheduleHandle} />
          <Text style={s.scheduleTitle}>Schedule delivery</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.scheduleDayRow}
          >
            {days.map((d, i) => {
              const isActive = activeDay === i
              const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
                : d.toLocaleDateString('en-NG', { weekday: 'short' })
              const sub = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
              return (
                <Pressable
                  key={d.toISOString()}
                  style={[s.scheduleDay, isActive && s.scheduleDayActive]}
                  onPress={() => setActiveDay(i)}
                >
                  <Text style={[s.scheduleDayLabel, isActive && s.scheduleDayLabelActive]}>{label}</Text>
                  <Text style={[s.scheduleDaySub, isActive && s.scheduleDaySubActive]}>{sub}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <View style={s.scheduleSlots}>
              {slots.length === 0 ? (
                <Text style={s.scheduleEmpty}>No slots available — try tomorrow</Text>
              ) : slots.map((slot) => (
                <Pressable
                  key={slot.toISOString()}
                  style={s.scheduleSlot}
                  onPress={() => onPick(slot)}
                >
                  <Text style={s.scheduleSlotText}>
                    {slot.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ── Main screen ────────────────────────────────────────────────────

export default function CartScreen() {
  const router     = useRouter()
  const navigation = useNavigation()
  const goBack     = () => navigation.canGoBack() ? router.back() : router.replace('/(customer)/' as never)
  const qc         = useQueryClient()
  const { items, restaurantId, updateQuantity, removeItem, clearCart } = useCartStore()
  const { isAuthenticated } = useAuthStore()

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod]         = useState<PaymentMethod>(PaymentMethod.CASH)

  // Tip — null means user hasn't picked anything yet (no chip selected)
  const [tipKobo, setTipKobo]               = useState<number>(0)
  const [customTipInput, setCustomTipInput] = useState<string>('')

  // Promo code
  const [couponInput, setCouponInput]       = useState<string>('')
  const [couponError, setCouponError]       = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon]   = useState<{
    code: string
    discountAmount: number
    couponType?: 'percentage' | 'fixed_amount' | 'free_delivery'
  } | null>(null)

  // Wallet
  const [useWallet, setUseWallet] = useState<boolean>(false)

  // Scheduling. null = order now. Date = order for that time.
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null)
  const [schedulePickerOpen, setSchedulePickerOpen] = useState(false)

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn:  () => usersApi.getProfile().then((r) => r.data.data),
    enabled:  isAuthenticated,
  })

  const { data: restaurantData } = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn:  () => restaurantsApi.getById(restaurantId!).then((r) => r.data.data),
    enabled:  !!restaurantId,
  })

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn:  () => walletApi.getBalance().then((r) => r.data.data),
    enabled:  isAuthenticated,
  })

  const addresses          = profileData?.addresses ?? []
  const deliveryFee        = restaurantData?.deliveryFeeFixed ?? 0
  const subtotal           = items.reduce((acc, i) => acc + i.itemTotal, 0)
  const serviceFee         = Math.min(Math.round(subtotal * SERVICE_FEE_RATE), SERVICE_FEE_CAP)
  const walletBalance      = walletData?.balance ?? 0

  // Coupon math. free_delivery waives delivery fee; everything else discounts the subtotal.
  const couponDiscount     = appliedCoupon?.couponType === 'free_delivery'
    ? deliveryFee
    : appliedCoupon?.discountAmount ?? 0
  const effectiveDeliveryFee = appliedCoupon?.couponType === 'free_delivery' ? 0 : deliveryFee

  const preWalletTotal     = subtotal + effectiveDeliveryFee + serviceFee + tipKobo - (
    appliedCoupon?.couponType === 'free_delivery' ? 0 : couponDiscount
  )
  const walletApplied      = useWallet ? Math.min(walletBalance, preWalletTotal) : 0
  const total              = Math.max(0, preWalletTotal - walletApplied)

  const effectiveAddressId = selectedAddressId ?? profileData?.defaultAddressId ?? null
  const totalItems         = items.reduce((acc, i) => acc + i.quantity, 0)

  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!restaurantId) throw new Error('No restaurant')
      const res = await couponsApi.validate({ code, restaurantId, subtotalKobo: subtotal })
      return res.data.data
    },
    onSuccess: (data, code) => {
      if (!data.valid) {
        setCouponError(data.errorMessage ?? 'Invalid coupon')
        setAppliedCoupon(null)
        return
      }
      setCouponError(null)
      setAppliedCoupon({
        code,
        discountAmount: data.discountAmount,
        couponType:     (data as { couponType?: 'percentage' | 'fixed_amount' | 'free_delivery' }).couponType,
      })
      toast.success(`Coupon applied — you save ${formatMoney(data.discountAmount)}`)
    },
    onError: () => {
      setCouponError('Could not validate coupon — try again')
      setAppliedCoupon(null)
    },
  })

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant selected')
      if (!effectiveAddressId) throw new Error('Please select a delivery address')

      // Resolve the selected address object from the saved addresses list
      const selectedAddress = addresses.find((a) => a._id === effectiveAddressId)
      if (!selectedAddress) throw new Error('Selected address not found. Please try again.')

      // GeoJSON stores [lng, lat] — backend expects { lat, lng }
      const [lng, lat] = selectedAddress.coordinates.coordinates

      // Idempotency key — one per checkout submission. Network retries
      // (or accidental double-tap) won't create a second order.
      const idempotencyKey =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      // Step 1: Create the order
      const order = await ordersApi.create(
        {
          restaurantId,
          items: items.map((i) => ({
            menuItemId:       i.menuItemId,
            quantity:         i.quantity,
            selectedVariants: i.selectedVariants,
            selectedAddOns:   i.selectedAddOns,
            note:             i.note ?? undefined,
          })),
          deliveryAddress: {
            street:      selectedAddress.street,
            city:        selectedAddress.city,
            state:       selectedAddress.state,
            coordinates: { lat, lng },
          },
          paymentMethod,
          tip:          tipKobo > 0 ? tipKobo : undefined,
          couponCode:   appliedCoupon?.code,
          useWallet:    useWallet && walletApplied > 0,
          scheduledFor: scheduledFor?.toISOString(),
        },
        idempotencyKey,
      ).then((r) => r.data.data)

      // Step 2: Paystack — only if there's anything left to charge after wallet.
      const amountLeftToCharge = order.pricing.total - (order.pricing.walletApplied ?? 0)
      if (paymentMethod === PaymentMethod.PAYSTACK && amountLeftToCharge > 0) {
        const payment = await paymentsApi.initiate({
          orderId: order._id,
          method:  PaymentMethod.PAYSTACK,
        }).then((r) => r.data.data)

        // Opens Paystack's secure payment page in the device browser.
        // Webhook finalises payment status on completion.
        await Linking.openURL(payment.authorizationUrl)
      }

      return order
    },
    onSuccess: (order) => {
      clearCart()
      // Seed the cache so the detail screen shows instantly without waiting for a refetch
      qc.setQueryData(['order', order._id], order)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['wallet'] })
      router.replace(`/(customer)/orders/${order._id}` as never)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { message?: string } }; message?: string }
      const status = e.response?.status

      if (status === 401) {
        void confirm({ title: 'Session expired', message: 'Please sign in again to place your order.', mode: 'alert', icon: 'warning' })
        return
      }
      if (status === 403) {
        void confirm({
          title:   'Customer account required',
          message: 'Orders can only be placed from a customer account. Please sign in with your customer account.',
          mode:    'alert',
          icon:    'info',
        })
        return
      }
      const msg = e.response?.data?.message ?? e.message ?? 'Something went wrong. Please try again.'
      void confirm({ title: 'Order failed', message: msg, mode: 'alert', variant: 'destructive', icon: 'warning' })
    },
  })

  const handlePlaceOrder = useCallback(async () => {
    if (!isAuthenticated) {
      const ok = await confirm({
        title:        'Sign in required',
        message:      'You need to sign in to place an order.',
        confirmLabel: 'Sign in',
        icon:         'info',
      })
      if (ok) router.push('/login' as never)
      return
    }
    if (!effectiveAddressId) {
      void confirm({ title: 'Add address', message: 'Please add a delivery address to continue.', mode: 'alert', icon: 'info' })
      return
    }
    const ok = await confirm({
      title:        'Place this order?',
      message:      `${totalItems} item${totalItems !== 1 ? 's' : ''}  ·  ${formatMoney(total)}`,
      confirmLabel: 'Place Order',
      icon:         'check',
    })
    if (ok) placeMutation.mutate()
  }, [effectiveAddressId, total, totalItems, placeMutation, isAuthenticated, router])

  // ── Empty state ────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={s.header}>
          <Pressable onPress={goBack} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Your Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="bag-outline" size={44} color={COLORS.primary} />
          </View>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySubtitle}>Add items from a restaurant to get started</Text>
          <Pressable style={s.browseBtn} onPress={() => router.replace('/(customer)/' as never)}>
            <Text style={s.browseBtnText}>Browse Restaurants</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const canOrder = !!effectiveAddressId && !placeMutation.isPending

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Your Cart</Text>
        <Pressable
          style={s.clearBtn}
          hitSlop={8}
          onPress={async () => {
            const ok = await confirm({
              title:        'Clear cart?',
              message:      'All items will be removed.',
              confirmLabel: 'Clear',
              variant:      'destructive',
              icon:         'trash',
            })
            if (ok) clearCart()
          }}
        >
          <Text style={s.clearBtnText}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Restaurant strip */}
        {restaurantData && (
          <View style={s.restaurantStrip}>
            <View style={s.restaurantStripLeft}>
              <View style={s.restaurantIconWrap}>
                <Ionicons name="storefront-outline" size={14} color={COLORS.primary} />
              </View>
              <Text style={s.restaurantStripName} numberOfLines={1}>{restaurantData.name}</Text>
            </View>
            <View style={s.etaChip}>
              <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.restaurantStripEta}>{restaurantData.estimatedDeliveryTime} min</Text>
            </View>
          </View>
        )}

        {/* Order items */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Order Summary</Text>
          <View style={s.itemsCard}>
            {items.map((item, idx) => (
              <CartItemRow
                key={item.menuItemId}
                item={item}
                onIncrease={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                onDecrease={() => {
                  if (item.quantity === 1) removeItem(item.menuItemId)
                  else updateQuantity(item.menuItemId, item.quantity - 1)
                }}
              />
            ))}
          </View>
        </View>

        {/* Delivery address */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Delivery Address</Text>
          <AddressSelector
            addresses={addresses}
            selectedId={effectiveAddressId}
            onSelect={setSelectedAddressId}
          />
        </View>

        {/* Payment method */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment Method</Text>
          <PaymentSelector selected={paymentMethod} onSelect={setPaymentMethod} />
        </View>

        {/* Tip your rider */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Tip Your Rider</Text>
          <View style={s.tipCard}>
            <View style={s.tipChips}>
              {TIP_PRESETS_KOBO.map((preset) => {
                const isActive = tipKobo === preset && customTipInput === ''
                return (
                  <Pressable
                    key={preset}
                    style={[s.tipChip, isActive && s.tipChipActive]}
                    onPress={() => {
                      setTipKobo(preset)
                      setCustomTipInput('')
                    }}
                  >
                    <Text style={[s.tipChipText, isActive && s.tipChipTextActive]}>
                      {preset === 0 ? 'No tip' : formatMoney(preset)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={s.tipCustomRow}>
              <Text style={s.tipNairaSign}>₦</Text>
              <TextInput
                style={s.tipCustomInput}
                placeholder="Custom amount"
                placeholderTextColor={COLORS.textTertiary}
                keyboardType="number-pad"
                value={customTipInput}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9]/g, '')
                  setCustomTipInput(cleaned)
                  const naira = parseInt(cleaned, 10)
                  setTipKobo(Number.isFinite(naira) ? naira * 100 : 0)
                }}
                maxLength={6}
              />
            </View>
            <Text style={s.tipHint}>100% of your tip goes to the rider.</Text>
          </View>
        </View>

        {/* Promo code */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Promo Code</Text>
          {appliedCoupon ? (
            <View style={s.couponAppliedCard}>
              <View style={s.couponAppliedLeft}>
                <View style={s.couponBadge}>
                  <Ionicons name="pricetag" size={14} color={COLORS.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.couponAppliedCode}>{appliedCoupon.code}</Text>
                  <Text style={s.couponAppliedSaving}>
                    {appliedCoupon.couponType === 'free_delivery'
                      ? `Free delivery — save ${formatMoney(deliveryFee)}`
                      : `You save ${formatMoney(appliedCoupon.discountAmount)}`}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setAppliedCoupon(null)
                  setCouponInput('')
                  setCouponError(null)
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.textTertiary} />
              </Pressable>
            </View>
          ) : (
            <View style={s.couponInputCard}>
              <View style={s.couponInputRow}>
                <Ionicons name="pricetag-outline" size={18} color={COLORS.textTertiary} />
                <TextInput
                  style={s.couponInput}
                  placeholder="Enter coupon code"
                  placeholderTextColor={COLORS.textTertiary}
                  autoCapitalize="characters"
                  value={couponInput}
                  onChangeText={(t) => {
                    setCouponInput(t.toUpperCase())
                    setCouponError(null)
                  }}
                  maxLength={50}
                />
                <Pressable
                  style={[
                    s.couponApplyBtn,
                    (!couponInput.trim() || applyCouponMutation.isPending) && s.couponApplyBtnDisabled,
                  ]}
                  onPress={() => applyCouponMutation.mutate(couponInput.trim())}
                  disabled={!couponInput.trim() || applyCouponMutation.isPending}
                >
                  {applyCouponMutation.isPending
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.couponApplyBtnText}>Apply</Text>}
                </Pressable>
              </View>
              {couponError && (
                <Text style={s.couponErrorText}>{couponError}</Text>
              )}
            </View>
          )}
        </View>

        {/* Wallet toggle (only if there's balance to spend) */}
        {walletBalance > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Wallet</Text>
            <View style={s.walletCard}>
              <View style={s.walletLeft}>
                <View style={s.walletIconWrap}>
                  <Ionicons name="wallet" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.walletTitle}>
                    {useWallet
                      ? `Using ${formatMoney(walletApplied)}`
                      : `Use ${formatMoney(walletBalance)} from wallet`}
                  </Text>
                  <Text style={s.walletSub}>
                    {useWallet
                      ? `Remaining balance: ${formatMoney(walletBalance - walletApplied)}`
                      : 'Apply your wallet credit to this order'}
                  </Text>
                </View>
              </View>
              <Switch
                value={useWallet}
                onValueChange={setUseWallet}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}

        {/* When to deliver */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>When to deliver</Text>
          <View style={s.scheduleRow}>
            <Pressable
              style={[s.scheduleOpt, !scheduledFor && s.scheduleOptActive]}
              onPress={() => setScheduledFor(null)}
            >
              <Ionicons name="flash" size={16} color={!scheduledFor ? COLORS.primary : COLORS.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.scheduleOptTitle, !scheduledFor && s.scheduleOptTitleActive]}>Order now</Text>
                <Text style={s.scheduleOptSub}>{restaurantData?.estimatedDeliveryTime ?? 30}–{(restaurantData?.estimatedDeliveryTime ?? 30) + 15} min</Text>
              </View>
            </Pressable>
            <Pressable
              style={[s.scheduleOpt, scheduledFor && s.scheduleOptActive]}
              onPress={() => setSchedulePickerOpen(true)}
            >
              <Ionicons name="time-outline" size={16} color={scheduledFor ? COLORS.primary : COLORS.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.scheduleOptTitle, scheduledFor && s.scheduleOptTitleActive]}>Schedule</Text>
                <Text style={s.scheduleOptSub}>
                  {scheduledFor
                    ? scheduledFor.toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                    : 'Pick a time'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Bill details */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bill Details</Text>
          <View style={s.billCard}>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Item total</Text>
              <Text style={s.priceValue}>{formatMoney(subtotal)}</Text>
            </View>
            <View style={s.priceRow}>
              <Text style={s.priceLabel}>Delivery fee</Text>
              <Text style={[s.priceValue, effectiveDeliveryFee === 0 && s.freeText]}>
                {effectiveDeliveryFee === 0 ? 'Free' : formatMoney(effectiveDeliveryFee)}
              </Text>
            </View>
            <View style={s.priceRow}>
              <View style={s.priceLabelRow}>
                <Text style={s.priceLabel}>Service fee</Text>
                <View style={s.infoChip}>
                  <Text style={s.infoChipText}>5%</Text>
                </View>
              </View>
              <Text style={s.priceValue}>{formatMoney(serviceFee)}</Text>
            </View>
            {tipKobo > 0 && (
              <View style={s.priceRow}>
                <Text style={s.priceLabel}>Tip</Text>
                <Text style={s.priceValue}>{formatMoney(tipKobo)}</Text>
              </View>
            )}
            {appliedCoupon && appliedCoupon.couponType !== 'free_delivery' && couponDiscount > 0 && (
              <View style={s.priceRow}>
                <Text style={[s.priceLabel, s.discountText]}>Coupon ({appliedCoupon.code})</Text>
                <Text style={[s.priceValue, s.discountText]}>-{formatMoney(couponDiscount)}</Text>
              </View>
            )}
            {walletApplied > 0 && (
              <View style={s.priceRow}>
                <Text style={[s.priceLabel, s.discountText]}>Wallet</Text>
                <Text style={[s.priceValue, s.discountText]}>-{formatMoney(walletApplied)}</Text>
              </View>
            )}
            <View style={s.billDivider} />
            <View style={s.priceRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>{formatMoney(total)}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Schedule picker modal */}
      <SchedulePicker
        visible={schedulePickerOpen}
        onClose={() => setSchedulePickerOpen(false)}
        onPick={(d) => {
          setScheduledFor(d)
          setSchedulePickerOpen(false)
        }}
      />

      {/* Sticky footer */}
      <View style={s.footer}>
        <View style={s.footerInner}>
          <View style={s.footerMeta}>
            <Text style={s.footerItemCount}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
            <Text style={s.footerTotal}>{formatMoney(total)}</Text>
            <Text style={s.footerNote}>incl. all fees</Text>
          </View>
          <Pressable
            style={[s.placeBtn, !canOrder && s.placeBtnDisabled]}
            onPress={handlePlaceOrder}
            disabled={!canOrder}
          >
            {placeMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={s.placeBtnInner}>
                <Text style={s.placeBtnText}>Place Order</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  clearBtn:    { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  clearBtnText:{ fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.error },

  scroll:        { flex: 1, backgroundColor: COLORS.surfaceHighlight },
  scrollContent: { paddingBottom: SPACING.xl },

  // Restaurant strip
  restaurantStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  restaurantStripLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  restaurantIconWrap:  {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  restaurantStripName: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary, flex: 1 },
  etaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  restaurantStripEta: { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  // Section
  section: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT.sm,
    fontFamily: FONTS.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },

  // Items card
  itemsCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  itemImage: {
    width: 56, height: 56,
    borderRadius: RADIUS.sm,
  },
  itemImageFallback: {
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  itemInfo:  { flex: 1, gap: 2 },
  itemName:  { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textPrimary, textTransform: 'capitalize' },
  itemMeta:  { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  itemPrice: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: COLORS.primary, marginTop: 4 },

  // Swiggy-style pill stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },
  stepperQty: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: FONT.sm,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    backgroundColor: COLORS.primaryFade,
    paddingVertical: 6,
  },

  // Address
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryFade,
  },
  addAddressBtnText: { fontSize: FONT.md, fontFamily: FONTS.medium, color: COLORS.primary },
  addressList: { gap: SPACING.sm },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
  addressCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  addressIconWrap: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceHighlight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  addressIconWrapSelected: { backgroundColor: 'rgba(234,88,12,0.12)' },
  addressCardBody:  { flex: 1, gap: 2 },
  addressLabel:     { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  addressStreet:    { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 16 },
  addressInstructions: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, fontStyle: 'italic' },
  addAnotherBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: SPACING.sm },
  addAnotherBtnText:{ fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.primary },

  // Payment
  paymentList: { gap: SPACING.sm },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
  paymentCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  paymentIconWrap: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentCardBody: { flex: 1, gap: 2 },
  paymentLabel:    { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  paymentLabelSelected: { color: COLORS.textPrimary },
  paymentDesc:     { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  // Radio
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner:         { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },

  // Tip
  tipCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  tipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  tipChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  tipChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  tipChipText:   { fontSize: FONT.sm, fontFamily: FONTS.medium,   color: COLORS.textSecondary },
  tipChipTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  tipCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  tipNairaSign: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: COLORS.textSecondary, marginRight: 6 },
  tipCustomInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  tipHint: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary },

  // Coupon
  couponInputCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  couponInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  couponInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    fontSize: FONT.md,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  couponApplyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyBtnDisabled: { opacity: 0.4 },
  couponApplyBtnText: { fontSize: FONT.sm, fontFamily: FONTS.bold, color: '#fff' },
  couponErrorText:    { fontSize: FONT.xs, fontFamily: FONTS.medium, color: COLORS.error },
  couponAppliedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  couponAppliedLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  couponBadge: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  couponAppliedCode:   { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#14532D', letterSpacing: 1 },
  couponAppliedSaving: { fontSize: FONT.xs, fontFamily: FONTS.regular, color: '#166534', marginTop: 1 },

  // Wallet
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
  },
  walletLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  walletIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
  },
  walletTitle: { fontSize: FONT.sm, fontFamily: FONTS.bold,   color: COLORS.textPrimary },
  walletSub:   { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },

  discountText: { color: COLORS.success, fontFamily: FONTS.semibold },

  // Schedule selector
  scheduleRow: { flexDirection: 'row', gap: SPACING.sm },
  scheduleOpt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  scheduleOptActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  scheduleOptTitle:       { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  scheduleOptTitleActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  scheduleOptSub:         { fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textTertiary, marginTop: 2 },

  // Schedule picker modal
  scheduleBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  scheduleSheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  scheduleHandle: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: COLORS.border, marginBottom: SPACING.sm,
  },
  scheduleTitle: { fontSize: FONT.lg, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },

  scheduleDayRow: { gap: SPACING.sm, paddingVertical: SPACING.sm },
  scheduleDay: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    minWidth: 84,
  },
  scheduleDayActive:      { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFade },
  scheduleDayLabel:       { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textSecondary },
  scheduleDayLabelActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  scheduleDaySub:         { fontSize: FONT.xs, fontFamily: FONTS.regular,  color: COLORS.textTertiary, marginTop: 2 },
  scheduleDaySubActive:   { color: COLORS.primary },

  scheduleSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  scheduleSlot: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    minWidth: 92,
    alignItems: 'center',
  },
  scheduleSlotText: { fontSize: FONT.sm, fontFamily: FONTS.semibold, color: COLORS.textPrimary },
  scheduleEmpty:    { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textTertiary, textAlign: 'center', padding: SPACING.xl },

  // Bill card
  billCard: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  priceRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabelRow:{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  priceLabel:   { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  priceValue:   { fontSize: FONT.sm, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  freeText:     { color: COLORS.success, fontFamily: FONTS.semibold },
  infoChip: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  infoChipText: { fontSize: 9, fontFamily: FONTS.semibold, color: COLORS.textTertiary },
  billDivider:  { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  totalLabel:   { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  totalValue:   { fontSize: FONT.md, fontFamily: FONTS.bold, color: COLORS.primary },

  // Footer
  footer: {
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    ...SHADOW.md,
  },
  footerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  footerMeta: { gap: 1 },
  footerItemCount:{ fontSize: FONT.xs, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  footerTotal:    { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: -0.4 },
  footerNote:     { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textTertiary },
  placeBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  placeBtnDisabled: { backgroundColor: COLORS.textTertiary, shadowOpacity: 0 },
  placeBtnInner:    { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  placeBtnText:     { fontSize: FONT.md, fontFamily: FONTS.bold, color: '#fff' },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryFade,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle:    { fontSize: FONT.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: FONT.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: 'center' },
  browseBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  browseBtnText: { fontSize: FONT.md, fontFamily: FONTS.semibold, color: '#fff' },
})
