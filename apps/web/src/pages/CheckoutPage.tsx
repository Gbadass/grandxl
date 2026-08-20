import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, CreditCard, Wallet, Banknote, ChevronRight, Plus, Gift, Navigation, Tag, Calendar, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi, paymentsApi, couponsApi, platformApi } from '@grandxl/api-client'
import { PaymentMethod, OrderStatus } from '@grandxl/types'
import type { Address, CouponValidationResult } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../features/cart/store/cart.store'
import { useAddresses } from '../features/addresses/hooks/useAddresses'
import { AddressPickerSheet } from '../features/addresses/components/AddressPickerSheet'
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
  const { t } = useTranslation(['cart', 'common'])
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
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)

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

  // Minimum datetime for scheduled delivery: 1 hour from now
  const minScheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)

  // After a cash/wallet order is placed the cart is cleared before navigation completes.
  // Use placedOrderId to skip the empty-cart guard and let the Navigate below handle it.
  if (placedOrderId) return <Navigate to={`/orders/${placedOrderId}/tracking`} replace />
  if (items.length === 0) return <Navigate to={ROUTES.CART} replace />

  async function applyCoupon() {
    if (!couponCode.trim()) return
    if (!restaurantId) {
      toast.error('Cannot apply coupon: no restaurant selected')
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
      toast.success('Coupon applied!')
    } catch (err: unknown) {
      setAppliedCoupon(null)
      toast.error(getApiErrorMessage(err, 'Invalid or expired coupon'))
    } finally {
      setCouponLoading(false)
    }
  }

  async function handlePlaceOrder() {
    if (isSubmitting) return
    if (!user) {
      void navigate(ROUTES.LOGIN, { state: { returnTo: ROUTES.CHECKOUT } })
      return
    }
    if (!selectedAddress) {
      toast.error('Please add a delivery address first')
      setAddressSheetOpen(true)
      return
    }
    if (!restaurantId) return

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
        ...(selectedAddress.coordinates
          ? {
              coordinates: {
                lat: selectedAddress.coordinates.coordinates[1],
                lng: selectedAddress.coordinates.coordinates[0],
              },
            }
          : {}),
      },
      paymentMethod,
      customerNote: customerNote.trim() || undefined,
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      couponCode: appliedCoupon ? couponCode.trim() : undefined,
      tip: tipKobo || undefined,
      scheduledFor: scheduledFor || undefined,
    }

    setIsSubmitting(true)
    try {
      const orderRes = await ordersApi.create(dto, crypto.randomUUID())
      const order = orderRes.data.data

      // Bust the orders cache so the new order appears immediately when navigating to /orders
      void queryClient.invalidateQueries({ queryKey: ['orders'] })

      if (paymentMethod === PaymentMethod.PAYSTACK) {
        const callbackUrl = `${window.location.origin}/payment/callback`
        let authorizationUrl: string
        try {
          const payRes = await paymentsApi.initiate({
            orderId: order._id,
            method: PaymentMethod.PAYSTACK,
            callbackUrl,
          })
          authorizationUrl = payRes.data.data.authorizationUrl
        } catch (payErr: unknown) {
          // Payment initiation failed — cancel the order so customer isn't left with a ghost order
          void ordersApi.cancel(order._id, 'Payment initiation failed').catch(() => undefined)
          throw payErr
        }
        clearCart()
        window.location.href = authorizationUrl
        return
      }

      clearCart()
      toast.success(t('orders:placed_success'))
      setPlacedOrderId(order._id)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('common:error')))
    } finally {
      setIsSubmitting(false)
    }
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
          <h1 className="font-display font-bold text-xl text-gray-900">Checkout</h1>
        </div>

        {/* Delivery address — tap to open picker */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <MapPin size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">Delivery address</h2>
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
                  Change <ChevronRight size={13} />
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
                <p className="text-sm font-medium text-primary">Add delivery address</p>
              </motion.button>
            )}
          </AnimatePresence>
        </section>

        {/* Delivery instructions */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Navigation size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">Delivery instructions</h2>
          </div>
          <textarea
            value={deliveryInstructions}
            onChange={(e) => setDeliveryInstructions(e.target.value)}
            placeholder="e.g. Flat 3B, ring bell twice, leave at door"
            rows={2}
            maxLength={300}
            className="w-full px-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
          />
        </section>

        {/* Coupon code */}
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Tag size={16} className="text-primary" />
            <h2 className="font-semibold text-sm text-gray-900">Coupon code</h2>
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
                  aria-label="Remove coupon"
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
                  placeholder="Enter coupon code"
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
                    'Apply'
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
            <h2 className="font-semibold text-sm text-gray-900">Payment method</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50">
            {[
              { method: PaymentMethod.PAYSTACK, icon: CreditCard, label: 'Card / Bank Transfer', sub: 'Powered by Paystack' },
              { method: PaymentMethod.WALLET,   icon: Wallet,     label: 'Wallet',               sub: 'Use your GrandXL balance' },
              { method: PaymentMethod.CASH,     icon: Banknote,   label: 'Cash on delivery',     sub: 'Pay when your order arrives' },
            ].map(({ method, icon: Icon, label, sub }) => (
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
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center ${paymentMethod === method ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                  {paymentMethod === method && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Note to restaurant */}
        <section className="mb-4">
          <label className="text-xs font-medium text-gray-500 block mb-1.5">
            Note to restaurant <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="e.g. No onions please"
            rows={2}
            className="w-full px-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
          />
        </section>

        {/* Tip selector */}
        <section className="mb-4">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              Tip your rider <span className="text-gray-400 font-normal">(optional)</span>
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
              Schedule delivery <span className="text-gray-400 font-normal text-xs">(optional)</span>
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
                <X size={11} /> Clear — deliver ASAP
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
                <p className="text-sm font-semibold text-green-800">Your first order — delivery is FREE!</p>
                <p className="text-xs text-green-600 mt-0.5">We're covering your delivery fee this time.</p>
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
                <Tag size={12} /> Coupon discount
              </span>
              <span className="font-medium">-{formatMoney(discount, currency)}</span>
            </div>
          )}
          {tipKobo > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Rider tip</span>
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
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-2xl px-5 font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ touchAction: 'manipulation', minHeight: '56px' }}
        >
          {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {isSubmitting
            ? 'Placing order…'
            : !user
            ? 'Sign in to place order'
            : `Place order · ${formatMoney(total, currency)}`}
        </motion.button>
      </div>

      {/* Address picker bottom sheet */}
      <AddressPickerSheet
        isOpen={addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        selected={selectedAddress}
        onSelect={setSelectedAddress}
      />
    </>
  )
}
