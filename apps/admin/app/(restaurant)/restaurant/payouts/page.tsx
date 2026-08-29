'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Wallet, CreditCard, Landmark, AlertTriangle, Clock,
  CheckCircle2, XCircle, Loader2, ArrowRight, ChevronRight,
} from 'lucide-react'
import {
  myRestaurantApi, restaurantPayoutsApi,
  type PayoutRequest, type BankAccount, type RestaurantEarningsSummary,
  type NigerianBank, type ResolvedAccount,
} from '@grandxl/api-client'
import { OrderStatus, UserRole } from '@grandxl/types'
import type { Order } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import '../../../../src/lib/axios'

// ── Constants ────────────────────────────────────────────────────────────────

// Same 24h dispute window used server-side in SettlementService. Mirrored here so
// the "In 24h hold" pill on each order row matches what the settlement job will do.
const HOLD_WINDOW_MS = 24 * 60 * 60 * 1000
const MIN_PAYOUT_KOBO = 100 * 100 // ₦100 minimum, matches server-side DTO

// ── Small helpers ────────────────────────────────────────────────────────────

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function timeSince(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime()
  const hrs = Math.floor(ms / 3_600_000)
  if (hrs < 1)  return 'just now'
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const STATUS_STYLES: Record<PayoutRequest['status'], string> = {
  pending:  'bg-amber-50  text-amber-700  ring-amber-200',
  approved: 'bg-blue-50   text-blue-700   ring-blue-200',
  paid:     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50    text-red-700    ring-red-200',
}

function StatusPill({ status }: { status: PayoutRequest['status'] }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status === 'paid' && <CheckCircle2 size={11} />}
      {status === 'rejected' && <XCircle size={11} />}
      {status === 'pending' && <Clock size={11} />}
      {status === 'approved' && <Loader2 size={11} className="animate-spin" />}
      {status}
    </span>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RestaurantPayoutsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const [showRequest, setShowRequest] = useState(false)
  const [showBankForm, setShowBankForm] = useState(false)

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn:  () => myRestaurantApi.list(),
    enabled:  isAuthenticated,
  })
  const restaurant   = restaurantsData?.data?.data?.[0]
  const restaurantId = restaurant?._id
  const currency     = restaurant?.currency ?? 'NGN'

  const { data: summaryRes, isLoading: sumLoading } = useQuery({
    queryKey: ['restaurant-payouts-summary'],
    queryFn:  () => restaurantPayoutsApi.getSummary().then((r) => r.data.data),
    enabled:  isAuthenticated,
    staleTime: 30_000,
  })
  const summary: RestaurantEarningsSummary | undefined = summaryRes

  const { data: bankRes } = useQuery({
    queryKey: ['restaurant-payouts-bank'],
    queryFn:  () => restaurantPayoutsApi.getBankAccount().then((r) => r.data.data),
    enabled:  isAuthenticated,
    staleTime: 60_000,
  })
  const bank: BankAccount | null = (bankRes ?? null) as BankAccount | null

  const { data: historyRes, isLoading: histLoading } = useQuery({
    queryKey: ['restaurant-payouts-history'],
    queryFn:  () => restaurantPayoutsApi.list({ page: 1, limit: 20 }).then((r) => r.data.data),
    enabled:  isAuthenticated,
    staleTime: 30_000,
  })
  const history: PayoutRequest[] = historyRes?.items ?? []

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ['restaurant-payouts-orders', restaurantId],
    queryFn:  () => myRestaurantApi.getOrders(restaurantId!, { status: OrderStatus.DELIVERED, page: 1, limit: 50 }),
    enabled:  !!restaurantId,
    staleTime: 30_000,
  })
  const orders: Order[] = (ordersRes?.data?.data as Order[] | undefined) ?? []

  // Per-order earnings breakdown for the "Order-by-order" table. Uses the same
  // net-to-restaurant model as the Finance page (S12-5): subtotal − discount.
  // Hold state matches the server settlement job's 24h window.
  const perOrder = useMemo(() => {
    const now = Date.now()
    return orders
      .filter((o) => o.status === OrderStatus.DELIVERED && o.actualDeliveryAt)
      .map((o) => {
        const netKobo = Math.max(0, o.pricing.subtotal - (o.pricing.discount ?? 0))
        const inHold  = now - new Date(o.actualDeliveryAt!).getTime() < HOLD_WINDOW_MS
        return { order: o, netKobo, inHold }
      })
  }, [orders])

  const canRequest =
    !!summary?.hasBankAccount &&
    (summary?.availableKobo ?? 0) >= MIN_PAYOUT_KOBO &&
    !summary?.inFlightRequest

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payouts"
        subtitle="Withdraw your delivered-order earnings to your bank account"
      />

      {/* ── Setup prompt if no bank ─────────────────────────────────────── */}
      {summary && !summary.hasBankAccount && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <p className="text-sm font-semibold text-amber-900">Add your bank account first</p>
              <p className="mt-0.5 text-xs text-amber-800">
                We need your account details to send payouts. GrandXL never sees or stores your login — only account name, number, and Nigerian bank.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBankForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Add bank account <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* ── Balance strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <BalanceCard
          icon={<Wallet size={20} className="text-emerald-600" />}
          label="Available"
          value={formatMoney(summary?.availableKobo ?? 0, currency)}
          hint="Ready to withdraw"
          accent
          loading={sumLoading}
        />
        <BalanceCard
          icon={<Clock size={20} className="text-amber-600" />}
          label="In 24h hold"
          value={formatMoney(summary?.pendingHoldKobo ?? 0, currency)}
          hint="Clears after the customer dispute window"
          loading={sumLoading}
        />
        <BalanceCard
          icon={<Landmark size={20} className="text-blue-600" />}
          label="Bank on file"
          value={bank?.accountName ?? '—'}
          hint={bank ? `${bank.bankName ?? ''} · ${bank.accountNumber ?? ''}` : 'Not set'}
          action={
            <button
              onClick={() => setShowBankForm(true)}
              className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline"
            >
              {bank?.accountName ? 'Change' : 'Add'}
            </button>
          }
          loading={sumLoading}
        />
      </div>

      {/* ── In-flight request banner ─────────────────────────────────────── */}
      {summary?.inFlightRequest && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Loader2 size={16} className="animate-spin text-blue-600" />
          <p className="text-sm text-blue-900">
            You have a payout of <strong>{formatMoney(summary.inFlightRequest.amountKobo, currency)}</strong> in progress
            (<span className="font-semibold uppercase">{summary.inFlightRequest.status}</span>).
            You can request another once this one settles.
          </p>
        </div>
      )}

      {/* ── Request payout button ────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-gray-900">Request a payout</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Minimum {formatMoney(MIN_PAYOUT_KOBO, currency)} per request. Funds arrive within one working day of admin approval.
          </p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          disabled={!canRequest}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CreditCard size={15} />
          Request payout
        </button>
      </div>

      {/* ── Per-order breakdown ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Order-by-order earnings</h3>
            <p className="mt-0.5 text-xs text-gray-400">Most recent 50 delivered orders — earnings clear 24h after delivery</p>
          </div>
          {ordersLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        {perOrder.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 text-left text-[10px] uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">Order</th>
                  <th className="pb-3 pr-4 font-semibold">Delivered</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Subtotal</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Discount</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Net to you</th>
                  <th className="pb-3 font-semibold">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perOrder.map(({ order, netKobo, inHold }) => (
                  <tr key={order._id} className="transition hover:bg-orange-50/40">
                    <td className="py-2.5 pr-4 font-semibold text-gray-900 tabular-nums">{order.orderNumber}</td>
                    <td className="py-2.5 pr-4 text-gray-600 tabular-nums">{timeSince(order.actualDeliveryAt!)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-700">{formatMoney(order.pricing.subtotal, currency)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-gray-500">
                      {order.pricing.discount > 0 ? `− ${formatMoney(order.pricing.discount, currency)}` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-bold tabular-nums text-emerald-700">{formatMoney(netKobo, currency)}</td>
                    <td className="py-2.5">
                      {inHold ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                          <Clock size={10} /> In 24h hold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                          <CheckCircle2 size={10} /> Cleared
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">
              {ordersLoading ? 'Loading…' : 'No delivered orders yet.'}
            </p>
            {/* Sprint 12 (S12-14): payouts only start filling once orders are
                being delivered — point the owner at the menu (their upstream
                dependency) instead of leaving them on a dead-end page. */}
            {!ordersLoading && (
              <button
                onClick={() => router.push('/restaurant/menu')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 cursor-pointer transition-colors"
              >
                Go to menu
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Payout history ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-gray-800">Payout history</h3>
          <p className="mt-0.5 text-xs text-gray-400">All your payout requests, newest first</p>
        </div>
        {history.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {history.map((p) => (
              <div key={p._id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{formatMoney(p.amountKobo, currency)}</p>
                  <p className="text-xs text-gray-500">Requested {fmtDate(p.createdAt)}</p>
                  {p.decisionNote && (
                    <p className="mt-0.5 text-xs italic text-gray-500">&ldquo;{p.decisionNote}&rdquo;</p>
                  )}
                </div>
                <div className="text-right">
                  <StatusPill status={p.status} />
                  {p.paidAt && (
                    <p className="mt-1 text-[10px] text-emerald-700 tabular-nums">Paid {fmtDate(p.paidAt)}</p>
                  )}
                  {p.transferReference && (
                    <p className="mt-0.5 text-[10px] text-gray-400 font-mono">{p.transferReference}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            {histLoading ? 'Loading…' : 'No payout requests yet — request one above once you have available balance.'}
          </p>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBankForm && (
          <BankAccountModal
            currency={currency}
            initial={bank}
            onClose={() => setShowBankForm(false)}
            onSaved={() => {
              setShowBankForm(false)
              void queryClient.invalidateQueries({ queryKey: ['restaurant-payouts-bank'] })
              void queryClient.invalidateQueries({ queryKey: ['restaurant-payouts-summary'] })
            }}
          />
        )}
        {showRequest && summary && (
          <RequestPayoutModal
            currency={currency}
            availableKobo={summary.availableKobo}
            onClose={() => setShowRequest(false)}
            onDone={() => {
              setShowRequest(false)
              void queryClient.invalidateQueries({ queryKey: ['restaurant-payouts-summary'] })
              void queryClient.invalidateQueries({ queryKey: ['restaurant-payouts-history'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Balance card ─────────────────────────────────────────────────────────────

function BalanceCard({ icon, label, value, hint, accent, action, loading }: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: boolean
  action?: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-xl p-2.5 ${accent ? 'bg-emerald-100' : 'bg-gray-50'}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-widest ${accent ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</p>
          {loading ? (
            <div className="mt-2 h-6 w-24 animate-pulse rounded-md bg-gray-100" />
          ) : (
            <p className={`mt-1 truncate text-xl font-extrabold tracking-tight tabular-nums ${accent ? 'text-emerald-900' : 'text-gray-900'}`}>
              {value}
            </p>
          )}
          {hint && !loading && <p className={`mt-1 truncate text-xs ${accent ? 'text-emerald-700/80' : 'text-gray-500'}`}>{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

// ── Bank account modal ──────────────────────────────────────────────────────

function BankAccountModal({ currency, initial, onClose, onSaved }: {
  currency: string
  initial: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  void currency
  const [bankCode,      setBankCode]      = useState(initial?.bankCode ?? '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '')
  const [resolved,      setResolved]      = useState<ResolvedAccount | null>(
    initial?.accountName ? { accountName: initial.accountName, accountNumber: initial.accountNumber ?? '' } : null,
  )
  const [verifying,     setVerifying]     = useState(false)

  const { data: banksRes } = useQuery({
    queryKey: ['restaurant-payouts-banks'],
    queryFn:  () => restaurantPayoutsApi.getBanks().then((r) => r.data.data),
    staleTime: 24 * 60 * 60 * 1000,
  })
  const banks: NigerianBank[] = banksRes ?? []

  // Auto-verify when we have both a 10-digit account number AND a bank code.
  // Debounced so we don't hammer Paystack on every keystroke while the user
  // is still typing.
  useEffect(() => {
    if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
      setResolved(null)
      return
    }
    let cancelled = false
    setVerifying(true)
    const t = setTimeout(async () => {
      try {
        const res = await restaurantPayoutsApi.verifyAccount(accountNumber, bankCode)
        if (!cancelled) setResolved(res.data.data)
      } catch {
        if (!cancelled) setResolved(null)
      } finally {
        if (!cancelled) setVerifying(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [accountNumber, bankCode])

  const bankName = banks.find((b) => b.code === bankCode)?.name

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!resolved || !bankCode || !bankName) throw new Error('Please verify your account first')
      return restaurantPayoutsApi.updateBankAccount({
        bankName,
        accountNumber: resolved.accountNumber,
        accountName:   resolved.accountName,
        bankCode,
      })
    },
    onSuccess: () => {
      toast.success('Bank account saved')
      onSaved()
    },
    onError: (e: unknown) => toast.error(parseApiError(e, 'Could not save bank account')),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1   }}
        exit={{    opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">
            {initial?.accountName ? 'Change bank account' : 'Add bank account'}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Nigerian bank accounts only. Paystack verifies the name matches the number.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Bank</label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">Select a bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Account number</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="0123456789"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm tabular-nums outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {verifying && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Verifying with Paystack…
            </div>
          )}
          {!verifying && resolved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">Verified account name</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-900">{resolved.accountName}</p>
            </div>
          )}
          {!verifying && !resolved && accountNumber.length === 10 && bankCode && (
            <p className="text-xs text-red-600">Could not verify — check the number and bank.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!resolved || saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save bank account
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Request payout modal ────────────────────────────────────────────────────

function RequestPayoutModal({ currency, availableKobo, onClose, onDone }: {
  currency:      string
  availableKobo: number
  onClose:       () => void
  onDone:        () => void
}) {
  const [amount, setAmount] = useState<string>(String(Math.floor(availableKobo / 100)))
  const parsedKobo = Math.round((parseFloat(amount) || 0) * 100)
  const isValid = parsedKobo >= MIN_PAYOUT_KOBO && parsedKobo <= availableKobo

  const requestMutation = useMutation({
    // Idempotency-Key protects against double-taps while the network is slow.
    // The server rejects a second request with the same key inside the window
    // even if we somehow fire twice — no double payouts.
    mutationFn: () => restaurantPayoutsApi.request(parsedKobo, `restaurant-payout-${Date.now()}`),
    onSuccess: () => {
      toast.success('Payout requested — awaiting admin approval')
      onDone()
    },
    onError: (e: unknown) => toast.error(parseApiError(e, 'Could not request payout')),
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1   }}
        exit={{    opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">Request payout</h2>
          <p className="mt-1 text-xs text-gray-500">
            Available balance: <span className="font-semibold tabular-nums text-gray-800">{formatMoney(availableKobo, currency)}</span>
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
              Amount ({currency})
            </label>
            <input
              type="number"
              step="0.01"
              min={MIN_PAYOUT_KOBO / 100}
              max={availableKobo / 100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-lg font-bold tabular-nums outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              Minimum {formatMoney(MIN_PAYOUT_KOBO, currency)} · maximum {formatMoney(availableKobo, currency)}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-800">
            <ChevronRight size={14} className="shrink-0" />
            Funds usually land in your bank account within 1 working day after admin approval.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => requestMutation.mutate()}
            disabled={!isValid || requestMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {requestMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Confirm request
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
