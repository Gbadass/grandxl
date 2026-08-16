import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, CreditCard, Wallet, Banknote, ChevronRight, Plus, Gift } from 'lucide-react'
import toast from 'react-hot-toast'
import { ordersApi, paymentsApi } from '@grandxl/api-client'
import { PaymentMethod, OrderStatus } from '@grandxl/types'
import type { Address } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useCartStore } from '../features/cart/store/cart.store'
import { useAddresses } from '../features/addresses/hooks/useAddresses'
import { AddressPickerSheet } from '../features/addresses/components/AddressPickerSheet'
import { useLocationStore } from '../store/location.store'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'
import { getApiErrorMessage } from '../lib/apiError'

const SERVICE_FEE_RATE = 0.05
const DELIVERY_FEE = 80000 // 800 NGN flat until dynamic API is ready


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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PAYSTACK)
  const [customerNote, setCustomerNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)

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
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE)
  const effectiveDeliveryFee = isFirstOrder ? 0 : DELIVERY_FEE
  const total = subtotal + serviceFee + effectiveDeliveryFee

  // After a cash/wallet order is placed the cart is cleared before navigation completes.
  // Use placedOrderId to skip the empty-cart guard and let the Navigate below handle it.
  if (placedOrderId) return <Navigate to={`/orders/${placedOrderId}/tracking`} replace />
  if (items.length === 0) return <Navigate to={ROUTES.CART} replace />

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
        coordinates: {
          lat: selectedAddress.coordinates.coordinates[1],
          lng: selectedAddress.coordinates.coordinates[0],
        },
      },
      paymentMethod,
      customerNote: customerNote.trim() || undefined,
    }

    setIsSubmitting(true)
    try {
      const orderRes = await ordersApi.create(dto, crypto.randomUUID())
      const order = orderRes.data.data

      // Bust the orders cache so the new order appears immediately when navigating to /orders
      void queryClient.invalidateQueries({ queryKey: ['orders'] })

      if (paymentMethod === PaymentMethod.PAYSTACK) {
        const callbackUrl = `${window.location.origin}/payment/callback`
        const payRes = await paymentsApi.initiate({
          orderId: order._id,
          method: PaymentMethod.PAYSTACK,
          callbackUrl,
        })
        clearCart()
        window.location.href = payRes.data.data.authorizationUrl
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

        {/* Note */}
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
                <span className="line-through text-gray-400">{formatMoney(DELIVERY_FEE, currency)}</span>
                <span className="font-semibold text-green-600">FREE</span>
              </span>
            ) : (
              <span>{formatMoney(DELIVERY_FEE, currency)}</span>
            )}
          </div>
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
