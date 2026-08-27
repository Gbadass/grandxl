import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, CreditCard, Wallet, Banknote, ChevronRight, Plus, Gift, Navigation, Tag, Calendar, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi, paymentsApi, couponsApi, platformApi, walletApi } from '@grandxl/api-client'
import { PaymentMethod, OrderStatus } from '@grandxl/types'
import type { Address, CouponValidationResult } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../features/cart/store/cart.store'
import { useAddresses } from '../features/addresses/hooks/useAddresses'
import { AddressPickerSheet } from '../features/addresses/components/AddressPickerSheet'
import { TopUpSheet } from '../features/wallet/components/TopUpSheet'
import { useLocationStore } from '../store/location.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'
import { getApiErrorMessage } from '../lib/apiError'

// Fallbacks used only until the platform pricing API responds
const DEFAULT_SERVICE_FEE_PERCENT = 5
const DEFAULT_DELIVERY_FEE = 80000

const TIP_PRESETS = [
  { label: 'No tip', kobo: 0 },
  { label: '₦200', kobo: 20000 },
  { label: '₦500', kobo: 50000 },
  { label: '₦1,000', kobo: 100000 },
]

export default function CheckoutPage() {
  const { t } = useTranslation(['cart', 'common', 'checkout'])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { items, restaurantId, clearCart } = useCartStore()
  const { addresses, defaultAddressId } = useAddresses()
  const { coordinates, city, state: locationState, displayAddress } = useLocationStore()

  // Build a temporary address from the detected location so it can be used
  // as the delivery address without requiring the user to save it first.
  const gpsAddress: Address | null = coordinates
    ? {
        _id: '__gps__',
        label: 'current location',
        street: displayAddress ?? city ?? 'Your location',
        city: city ?? 'Your location',
        state: locationState ?? 'Benue',
        country: 'NG',
        coordinates: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] },
        instructions: null,
      }
    : null

  // Priority: saved default → first saved address → detected GPS location
  const defaultAddress =
    addresses.find((a) => a._id === defaultAddressId) ??
    addresses[0] ??
    gpsAddress
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(defaultAddress)
  const [addressSheetOpen, setAddressSheetOpen] = useState(false)

  // Clear selected address if it was deleted from the saved list
  useEffect(() => {
    if (
      selectedAddress &&
      selectedAddress._id !== '__gps__' &&
      !addresses.some((a) => a._id === selectedAddress._id)
    ) {
      setSelectedAddress(addresses[0] ?? gpsAddress ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses])

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PAYSTACK)
  const [customerNote, setCustomerNote] = useState('')
  const [deliveryInstructions, setDeliveryInstructions] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [showTopUp, setShowTopUp] = useState(false)

  // Wallet balance — fetched only when signed in. Kept fresh (short staleTime)
  // because a top-up return trip should reflect immediately.
  const {
    data: walletData,
    isLoading: walletLoading,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => walletApi.getBalance().then((r) => r.data.data),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
  const walletBalance = walletData?.balance ?? 0

  // --- Coupon code ---
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Clear coupon when the restaurant changes (e.g. cart is swapped)
  useEffect(() => {
    setCouponCode('')
    setAppliedCoupon(null)
  }, [restaurantId])

  // --- Tip ---
  const [tipKobo, setTipKobo] = useState(0)

  // --- Scheduled delivery ---
  const [scheduledFor, setScheduledFor] = useState('')
  // Sprint 12 (S12-11): far-delivery confirm modal. Populated when the server
  // rejects the initial submit with the "outside normal range" error; the modal
  // extracts the two numbers from the error and asks the customer to confirm.
  const [farDeliveryPrompt, setFarDeliveryPrompt] = useState<{
    message: string
    distanceKm: string | null
    radiusKm:   string | null
  } | null>(null)

  // Dynamic platform pricing — service fee % and delivery tiers
  const { data: pricingData } = useQuery({
    queryKey: ['platform-pricing'],
    queryFn: () => platformApi.getPricing().then((res) => res.data.data),
    staleTime: 5 * 60 * 1000,
  })
  const serviceFeePercent = pricingData?.serviceFeePercent ?? DEFAULT_SERVICE_FEE_PERCENT
  const serviceFeeCapKobo = pricingData?.serviceFeeCapKobo ?? 150_000
  // Use first delivery tier fee as flat fee when no distance is available client-side
  const baseDeliveryFee = pricingData?.deliveryTiers?.[0]?.feeKobo ?? DEFAULT_DELIVERY_FEE

  // Detect first-order status: if the user has no non-cancelled orders, delivery is free
  const { data: hasNoPriorOrders } = useQuery({
    queryKey: ['orders', 'first-order-check'],
    queryFn: () =>
      ordersApi.getHistory({ page: 1, limit: 5 }).then((r) => {
        const payload = r.data.data
        const all: { status: string }[] = payload?.data ?? payload ?? []
        const nonCancelled = all.filter((o) => o.status !== OrderStatus.CANCELLED)
        const total: number = payload?.meta?.total ?? all.length
        return total === 0 || nonCancelled.length === 0
      }),
    enabled: Boolean(user),
    staleTime: 0,
  })
  const isFirstOrder = Boolean(user && hasNoPriorOrders)

  const currency = 'NGN'
  const subtotal = items.reduce((acc, item) => acc + item.itemTotal, 0)
  const serviceFee = Math.min(Math.round(subtotal * serviceFeePercent / 100), serviceFeeCapKobo)
  const effectiveDeliveryFee = isFirstOrder ? 0 : baseDeliveryFee
  const discount = appliedCoupon?.discountAmount ?? 0
  const total = subtotal + serviceFee + effectiveDeliveryFee - discount + tipKobo

  // Wallet-only payment requires the balance to cover the full order total.
  // When it doesn't, we surface the shortfall and offer an inline top-up.
  const walletShortfall = Math.max(0, total - walletBalance)
  const walletCoversOrder = walletBalance >= total
  const walletMethodBlocked = paymentMethod === PaymentMethod.WALLET && !walletCoversOrder

  // Minimum datetime for scheduled delivery: 1 hour from now
  const minScheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)

  // After a cash/wallet order is placed the cart is cleared before navigation completes.
  // Use placedOrderId to skip the empty-cart guard and let the Navigate below handle it.
  if (placedOrderId) return <Navigate to={`/orders/${placedOrderId}/tracking`} replace />
  if (items.length === 0) return <Navigate to={ROUTES.CART} replace />

  async function applyCoupon() {
    if (!couponCode.trim()) return
    if (!restaurantId) {
      toast.error(t('checkout:couponNoRestaurant'))
      return
    }
    setCouponLoading(true)
    try {
      const res = await couponsApi.validate({
        code: couponCode.trim(),
        restaurantId,
        subtotalKobo: subtotal,
      })
      setAppliedCoupon(res.data.data)
      toast.success(t('checkout:couponApplied'))
    } catch (err: unknown) {
      setAppliedCoupon(null)
      toast.error(getApiErrorMessage(err, t('checkout:invalidCoupon')))
    } finally {
      setCouponLoading(false)
    }
  }

  async function handlePlaceOrder(opts?: { farDeliveryAcknowledged?: boolean }) {
    // useRef guard is synchronous — closes the race between two rapid taps that both
    // pass a useState check before the first setIsSubmitting(true) re-renders.
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    if (!user) {
      isSubmittingRef.current = false
      void navigate(ROUTES.LOGIN, { state: { returnTo: ROUTES.CHECKOUT } })
      return
    }
    if (!selectedAddress) {
      isSubmittingRef.current = false
      toast.error(t('checkout:addAddressFirst'))
      setAddressSheetOpen(true)
      return
    }
    if (!restaurantId) {
      isSubmittingRef.current = false
      return
    }

    // Wallet-only: balance must cover the full total. If it doesn't, offer a
    // top-up. The backend also enforces this via debitUpTo + payment.status
    // check, but blocking client-side gives immediate, clear feedback.
    if (paymentMethod === PaymentMethod.WALLET && !walletCoversOrder) {
      isSubmittingRef.current = false
      toast.error(t('checkout:walletInsufficientError'))
      setShowTopUp(true)
      return
    }

    // Resolve delivery coordinates — GeoJSON stores [lng, lat]
    const addrLng = selectedAddress.coordinates?.coordinates?.[0] ?? 0
    const addrLat = selectedAddress.coordinates?.coordinates?.[1] ?? 0
    // GPS fallback: only use location store coords if they are within real-world bounds
    const gpsLat = coordinates?.lat
    const gpsLng = coordinates?.lng
    const isValidGps =
      gpsLat !== undefined && gpsLng !== undefined &&
      gpsLat >= -90 && gpsLat <= 90 && gpsLng >= -180 && gpsLng <= 180
    const resolvedLat = addrLat !== 0 ? addrLat : (isValidGps ? gpsLat! : 0)
    const resolvedLng = addrLng !== 0 ? addrLng : (isValidGps ? gpsLng! : 0)

    // Guard: both 0,0 means no coordinates at all — prompt user to re-enter address with GPS
    if (resolvedLat === 0 && resolvedLng === 0) {
      isSubmittingRef.current = false
      toast.error(t('checkout:addressNeedsLocation'))
      setAddressSheetOpen(true)
      return
    }
    // Guard: out-of-range values (stale bad data) — clear and ask user to re-enter
    if (resolvedLat < -90 || resolvedLat > 90 || resolvedLng < -180 || resolvedLng > 180) {
      isSubmittingRef.current = false
      toast.error(t('checkout:addressNeedsLocation'))
      setAddressSheetOpen(true)
      return
    }

    const dto = {
      restaurantId,
      items: items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        selectedVariants: item.selectedVariants,
        selectedAddOns: item.selectedAddOns,
        note: item.note ?? undefined,
      })),
      deliveryAddress: {
        street: selectedAddress.street,
        city: selectedAddress.city,
        state: selectedAddress.state,
        coordinates: { lat: resolvedLat, lng: resolvedLng },
      },
      paymentMethod,
      // When the user picks WALLET, the backend needs useWallet=true to
      // actually debit the wallet against the total. Without this flag the
      // order would sit as PENDING and eventually auto-cancel.
      useWallet: paymentMethod === PaymentMethod.WALLET ? true : undefined,
      customerNote: customerNote.trim() || undefined,
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      couponCode: appliedCoupon ? couponCode.trim() : undefined,
      tip: tipKobo || undefined,
      scheduledFor: scheduledFor || undefined,
      // Sprint 12 (S12-11): only true after the customer explicitly confirms
      // via the far-delivery modal — the modal calls this same function with
      // the flag set, and the server double-checks the geometry either way.
      farDeliveryAcknowledged: opts?.farDeliveryAcknowledged || undefined,
    }

    setIsSubmitting(true)
    try {
      const orderRes = await ordersApi.create(dto, crypto.randomUUID())
      const order = orderRes.data.data

      // Bust the orders cache so the new order appears immediately when navigating to /orders
      void queryClient.invalidateQueries({ queryKey: ['orders'] })

      if (paymentMethod === PaymentMethod.PAYSTACK) {
        let accessCode: string
        let paystackRef: string
        let authorizationUrl: string
        try {
          const payRes = await paymentsApi.initiate({
            orderId: order._id,
            method:  PaymentMethod.PAYSTACK,
          })
          accessCode       = payRes.data.data.accessCode
          paystackRef      = payRes.data.data.reference
          authorizationUrl = payRes.data.data.authorizationUrl
        } catch (payErr: unknown) {
          void ordersApi.cancel(order._id, 'Payment initiation failed').catch(() => undefined)
          throw payErr
        }

        // Store IDs for the AppShell recovery hook in case the user kills the tab
        // entirely (bypassing both popup onClose and callback).
        sessionStorage.setItem('pendingPaystackOrderId', order._id)
        sessionStorage.setItem('pendingPaystackReference', paystackRef)

        // Keep the Place Order button LOCKED while the Paystack popup is open. A
        // previous version unlocked it here for "retry if cancel", but that opened
        // a race — user could tap Place Order again during the popup and create a
        // second ghost order. The onCancel callback below re-enables it correctly.

        // Open Paystack inline popup — stays on this page, no full-page redirect.
        // v2 API: when the backend pre-initializes the transaction (which we do),
        // use resumeTransaction(access_code, callbacks) — NOT newTransaction().
        type PaystackPopInstance = {
          resumeTransaction(
            accessCode: string,
            callbacks: {
              onSuccess(response: { reference: string }): void
              onCancel(): void
            },
          ): void
        }
        type PaystackPopCtor = new () => PaystackPopInstance
        const PaystackPop = (window as unknown as { PaystackPop?: PaystackPopCtor }).PaystackPop
        if (!PaystackPop) {
          // Script not yet loaded (very slow network) — fall back to redirect.
          // Leave the button locked; the user is about to leave the page anyway.
          window.location.href = authorizationUrl
          return
        }

        new PaystackPop().resumeTransaction(accessCode, {
          onCancel() {
            // User closed the popup without paying — cancel the ghost order silently
            sessionStorage.removeItem('pendingPaystackOrderId')
            sessionStorage.removeItem('pendingPaystackReference')
            void ordersApi.cancel(order._id, 'Payment cancelled by user').catch(() => undefined)
            toast(t('checkout:paymentCancelled', 'Payment cancelled — your cart is ready.'))
            // Re-enable Place Order so user can retry from the same cart
            isSubmittingRef.current = false
            setIsSubmitting(false)
          },

          onSuccess(_response) {
            // Payment completed — clear cart and navigate to tracking.
            // No need to unlock the button; we're navigating away.
            clearCart()
            sessionStorage.removeItem('pendingPaystackOrderId')
            sessionStorage.removeItem('pendingPaystackReference')
            void queryClient.invalidateQueries({ queryKey: ['orders'] })
            setPlacedOrderId(order._id)
          },
        })
        return
      }

      // Wallet-covered order was debited server-side; refresh balance so the
      // sidebar/wallet page doesn't show a stale figure on next view.
      if (paymentMethod === PaymentMethod.WALLET) {
        void queryClient.invalidateQueries({ queryKey: ['wallet-balance'] })
      }

      clearCart()
      toast.success(t('orders:placed_success'))
      setPlacedOrderId(order._id)
    } catch (err: unknown) {
      // Sprint 12 (S12-11): server rejects out-of-range addresses with a message
      // like "This address is 6.2 km from the restaurant — outside their 5 km
      // normal range. Please acknowledge and retry." Pull the two numbers out
      // and open the confirm modal instead of just toasting.
      const msg = getApiErrorMessage(err, '')
      const match = /is\s+([\d.]+)\s+km\s+.*outside their\s+([\d.]+)\s+km/i.exec(msg)
      if (match && !opts?.farDeliveryAcknowledged) {
        setFarDeliveryPrompt({ message: msg, distanceKm: match[1] ?? null, radiusKm: match[2] ?? null })
      } else {
        toast.error(getApiErrorMessage(err, t('common:error')))
      }
      // On any error, unlock so user can try again
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
    // NOTE: no finally block. Success paths (Paystack popup + navigation OR non-Paystack
    // placement) intentionally leave the button locked — user is either mid-payment or
    // about to be navigated to /orders. Only onCancel and catch re-enable it.
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pb-36">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => void navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            aria-label={t('common:back')}
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="font-display font-bold text-xl text-gray-900">{t('checkout:title')}</h1>
        </div>

        {/* Delivery address — tap to open picker */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <MapPin size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">{t('checkout:deliveryAddress')}</h2>
          </div>

          <AnimatePresence mode="wait">
            {selectedAddress ? (
              <motion.button
                key="selected"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setAddressSheetOpen(true)}
                className="w-full text-left bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 capitalize">{selectedAddress.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedAddress.street}</p>
                  <p className="text-xs text-gray-400">{selectedAddress.city}, {selectedAddress.state}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium shrink-0 mt-1">
                  {t('checkout:changeAddress')} <ChevronRight size={13} />
                </div>
              </motion.button>
            ) : (
              <motion.button
                key="empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setAddressSheetOpen(true)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border-2 border-dashed border-primary/30"
                style={{ touchAction: 'manipulation' }}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus size={16} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-primary">{t('checkout:addAddress')}</p>
              </motion.button>
            )}
          </AnimatePresence>
        </section>

        {/* Delivery instructions */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Navigation size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">{t('checkout:instructions')}</h2>
          </div>
          <textarea
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder={t('checkout:instructionsPlaceholder')}
            rows={2}
            maxLength={300}
            className="w-full px-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
          />
        </section>

        {/* Coupon code */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Tag size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">{t('checkout:couponCode')}</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Tag size={14} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-700 truncate">{couponCode.trim()}</p>
                    <p className="text-xs text-green-600">
                      -{formatMoney(appliedCoupon.discountAmount, currency)} discount
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAppliedCoupon(null); setCouponCode('') }}
                  className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors cursor-pointer"
                  aria-label={t('checkout:removeCoupon')}
                >
                  <X size={13} className="text-gray-500" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') void applyCoupon() }}
                  placeholder={t('checkout:couponPlaceholder')}
                  className="flex-1 min-w-0 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
                <button
                  type="button"
                  onClick={() => void applyCoupon()}
                  disabled={!couponCode.trim() || couponLoading}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  style={{ touchAction: 'manipulation' }}
                >
                  {couponLoading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin inline-block" />
                  ) : (
                    t('checkout:apply')
                  )}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Payment method */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <CreditCard size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">{t('checkout:paymentMethod')}</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
            {[
              { method: PaymentMethod.PAYSTACK, icon: CreditCard, label: t('checkout:paymentCard'),   sub: t('checkout:paymentCardSub') },
              { method: PaymentMethod.WALLET,   icon: Wallet,     label: t('checkout:paymentWallet'), sub: t('checkout:paymentWalletSub') },
              { method: PaymentMethod.CASH,     icon: Banknote,   label: t('checkout:paymentCash'),   sub: t('checkout:paymentCashSub') },
            ].map(({ method, icon: Icon, label, sub }) => {
              const isWallet = method === PaymentMethod.WALLET
              const walletSubLine = isWallet
                ? walletLoading
                  ? t('checkout:walletLoadingBalance')
                  : t('checkout:walletBalance', { amount: formatMoney(walletBalance, currency) })
                : sub
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                  style={{ touchAction: 'manipulation', minHeight: '56px' }}
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${paymentMethod === method ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className={`text-xs ${isWallet && !walletLoading && walletCoversOrder && paymentMethod === PaymentMethod.WALLET ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                      {walletSubLine}
                    </p>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${paymentMethod === method ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                    {paymentMethod === method && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Insufficient-balance banner — only when Wallet is the active method */}
          <AnimatePresence>
            {paymentMethod === PaymentMethod.WALLET && !walletLoading && !walletCoversOrder && (
              <motion.div
                key="wallet-insufficient"
                role="alert"
                aria-live="polite"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      {t('checkout:walletInsufficient')}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {t('checkout:walletShortBy', { amount: formatMoney(walletShortfall, currency) })}
                    </p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setShowTopUp(true)}
                    style={{ minHeight: 40, touchAction: 'manipulation' }}
                    className="shrink-0 px-3.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    {t('checkout:walletTopUp')}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Note to restaurant */}
        <section className="mb-4">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">
            {t('checkout:noteToRestaurant')} <span className="text-gray-400">{t('checkout:optional')}</span>
          </label>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder={t('checkout:notePlaceholder')}
            rows={2}
            className="w-full px-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
          />
        </section>

        {/* Tip selector */}
        <section className="mb-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {t('checkout:tipRider')} <span className="text-gray-400 font-normal">{t('checkout:optional')}</span>
            </p>
            <div className="flex gap-2">
              {TIP_PRESETS.map(({ label, kobo }) => (
                <button
                  key={kobo}
                  type="button"
                  onClick={() => setTipKobo(kobo)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer border ${
                    tipKobo === kobo
                      ? 'bg-primary text-white border-primary'
                      : 'bg-gray-50 text-gray-700 border-transparent hover:border-primary/30 hover:bg-primary/5'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Schedule delivery */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Calendar size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">
              {t('checkout:scheduleDelivery')} <span className="text-gray-400 font-normal text-xs">{t('checkout:optional')}</span>
            </h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              min={minScheduledFor}
              className="w-full px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
            {scheduledFor && (
              <button
                type="button"
                onClick={() => setScheduledFor('')}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer flex items-center gap-1"
              >
                <X size={11} /> {t('checkout:clearSchedule')}
              </button>
            )}
          </div>
        </section>

        {/* First-order free delivery banner */}
        <AnimatePresence>
          {isFirstOrder && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3"
            >
              <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Gift size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">{t('checkout:firstOrderFree')}</p>
                <p className="text-xs text-green-600 mt-0.5">{t('checkout:firstOrderFreeSub')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order summary */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('cart:subtotal')}</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('cart:serviceFee')}</span>
            <span>{formatMoney(serviceFee, currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('cart:deliveryFee')}</span>
            {isFirstOrder ? (
              <span className="flex items-center gap-1.5">
                <span className="line-through text-gray-400">{formatMoney(baseDeliveryFee, currency)}</span>
                <span className="font-semibold text-green-600">FREE</span>
              </span>
            ) : (
              <span>{formatMoney(baseDeliveryFee, currency)}</span>
            )}
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span className="flex items-center gap-1">
                <Tag size={12} /> {t('checkout:couponDiscount')}
              </span>
              <span className="font-medium">-{formatMoney(discount, currency)}</span>
            </div>
          )}
          {tipKobo > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>{t('checkout:riderTip')}</span>
              <span>{formatMoney(tipKobo, currency)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900">
            <span>{t('cart:total')}</span>
            <span className="text-primary">{formatMoney(total, currency)}</span>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-[68px] left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3 z-40">
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.08 }}
          onClick={() => void handlePlaceOrder()}
          disabled={isSubmitting || walletMethodBlocked}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-2xl px-5 font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ touchAction: 'manipulation', minHeight: '56px' }}
        >
          {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {isSubmitting
            ? t('checkout:placingOrder')
            : !user
            ? t('checkout:signInToOrder')
            : walletMethodBlocked
            ? t('checkout:walletInsufficient')
            : t('checkout:placeOrder', { amount: formatMoney(total, currency) })}
        </motion.button>
      </div>

      {/* Address picker bottom sheet */}
      <AddressPickerSheet
        isOpen={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        selected={selectedAddress}
        onSelect={setSelectedAddress}
      />

      {/* Wallet top-up bottom sheet — reachable from the insufficient-balance
          banner or the auto-open in handlePlaceOrder when wallet is short. */}
      <AnimatePresence>
        {showTopUp && (
          <TopUpSheet
            onClose={() => setShowTopUp(false)}
            suggestedKobo={walletShortfall > 0 ? walletShortfall : undefined}
          />
        )}
      </AnimatePresence>

      {/* Sprint 12 (S12-11): far-delivery acknowledgement modal */}
      <AnimatePresence>
        {farDeliveryPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFarDeliveryPrompt(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1   }}
              exit={{    opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="text-lg font-extrabold text-gray-900">Address outside normal range</h2>
                <p className="mt-1 text-xs text-gray-500">
                  This restaurant may charge more or take longer for far deliveries. Confirm you still want to proceed.
                </p>
              </div>
              <div className="px-6 py-5 space-y-3">
                {farDeliveryPrompt.distanceKm && farDeliveryPrompt.radiusKm && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">Distance</p>
                      <p className="mt-0.5 text-xl font-extrabold text-amber-900 tabular-nums">{farDeliveryPrompt.distanceKm} km</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Normal range</p>
                      <p className="mt-0.5 text-xl font-extrabold text-gray-800 tabular-nums">{farDeliveryPrompt.radiusKm} km</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">{farDeliveryPrompt.message}</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
                <button
                  onClick={() => setFarDeliveryPrompt(null)}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setFarDeliveryPrompt(null)
                    void handlePlaceOrder({ farDeliveryAcknowledged: true })
                  }}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Deliver anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
