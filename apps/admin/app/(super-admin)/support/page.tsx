'use client'

// S13-14: customer support triage page. Search bar at top (phone / email /
// name / order number). Result rows are clickable customers. Selecting one
// pulls the overview (profile, wallet, recent orders/disputes/refunds) in a
// single round-trip and surfaces support actions inline: send a targeted
// push message, force refund on any recent order, emergency wallet credit.

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { adminSupportApi } from '@grandxl/api-client'
import type { CustomerLookupResult, CustomerOverview } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import '../../../src/lib/axios'

// ── Utils ────────────────────────────────────────────────────────────────────
function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

// Order-status pill color mapper — matches the palette used on /orders
function statusToneClasses(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('deliver')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (s.includes('cancel')) return 'bg-red-50 text-red-700 ring-red-200'
  if (s.includes('pending') || s.includes('placed')) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-blue-50 text-blue-700 ring-blue-200'
}

// ── Contact modal ────────────────────────────────────────────────────────────
function ContactCustomerModal({
  userId, userLabel, open, onClose,
}: {
  userId: string
  userLabel: string
  open: boolean
  onClose: () => void
}) {
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [actionUrl, setActionUrl] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(''); setBody(''); setActionUrl('')
  }, [open])

  const sendMutation = useMutation({
    mutationFn: () =>
      adminSupportApi.contactCustomer({
        userId,
        title:     title.trim(),
        body:      body.trim(),
        actionUrl: actionUrl.trim() || undefined,
      }),
    onSuccess: (res) => {
      if (res.data.data.delivered) toast.success('Message delivered')
      else toast.error('Message saved but push delivery failed — customer may not have notifications enabled')
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not send message')),
  })

  const urlValid = !actionUrl.trim() || /^https?:\/\//.test(actionUrl.trim())
  const canSend  = title.trim().length >= 3 && body.trim().length >= 3 && urlValid && !sendMutation.isPending

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Contact customer</h3>
                <p className="mt-0.5 truncate text-xs text-gray-500">Sending to {userLabel}</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. About your recent order"
                  maxLength={120}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                  autoFocus
                />
                <p className="mt-1 text-right text-[10px] text-gray-400">{title.length}/120</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi Gerald, we'd like to follow up on your last delivery. Please reply here."
                  maxLength={1000}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                />
                <p className="mt-1 text-right text-[10px] text-gray-400">{body.length}/1000</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Deep link (optional)</label>
                <input
                  type="url"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  placeholder="https://grandxl.com/orders/GXL-1234"
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none ${
                    urlValid ? 'border-gray-200 focus:border-gray-400' : 'border-red-300 focus:border-red-400'
                  }`}
                />
                {!urlValid && <p className="mt-1 text-[10px] text-red-500">URL must start with http:// or https://</p>}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sendMutation.isPending}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                onClick={() => sendMutation.mutate()}
                disabled={!canSend}
                whileTap={{ scale: canSend ? 0.98 : 1 }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendMutation.isPending ? 'Sending…' : 'Send push'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Emergency credit modal (mirrors S13-5's UsersPage modal) ────────────────
function EmergencyCreditModal({
  userId, userLabel, open, onClose, onDone,
}: {
  userId: string
  userLabel: string
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [amountNaira, setAmountNaira] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setAmountNaira(''); setReason('')
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      const kobo = Math.round(parseFloat(amountNaira) * 100)
      return adminSupportApi.emergencyCredit({ userId, amountKobo: kobo, reason: reason.trim() })
    },
    onSuccess: (res) => {
      toast.success(`Credited ${formatMoney(res.data.data.creditedKobo, 'NGN')}`)
      onDone()
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not credit customer')),
  })

  const amountValid = parseFloat(amountNaira) > 0
  const canSend = amountValid && reason.trim().length >= 3 && !mutation.isPending

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Emergency wallet credit</h3>
              <p className="mt-0.5 text-xs text-gray-500">For {userLabel}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Amount (₦)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amountNaira}
                  onChange={(e) => setAmountNaira(e.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Escalation ticket #123 — customer had three cold deliveries"
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={mutation.isPending}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={!canSend}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mutation.isPending ? 'Crediting…' : 'Credit wallet'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Force refund modal ──────────────────────────────────────────────────────
function ForceRefundModal({
  order, open, onClose, onDone,
}: {
  order: CustomerOverview['orders'][number] | null
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [amountNaira, setAmountNaira] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open || !order) return
    setAmountNaira((order.total / 100).toFixed(2))
    setReason('')
  }, [open, order])

  const mutation = useMutation({
    mutationFn: () => {
      if (!order) throw new Error('No order')
      const kobo = Math.round(parseFloat(amountNaira) * 100)
      return adminSupportApi.forceRefund({
        orderId:    order._id,
        amountKobo: kobo,
        reason:     reason.trim(),
      })
    },
    onSuccess: (res) => {
      toast.success(`Refunded ${formatMoney(res.data.data.refundedKobo, 'NGN')}`)
      onDone()
      onClose()
    },
    onError: (err) => toast.error(parseApiError(err, 'Could not refund order')),
  })

  const amountValid = parseFloat(amountNaira) > 0
  const canSend = amountValid && reason.trim().length >= 3 && !mutation.isPending

  return (
    <AnimatePresence>
      {open && order && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900">Force refund</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Order <span className="font-mono">{order.orderNumber}</span> · total {formatMoney(order.total, 'NGN')}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Amount to refund (₦)</label>
                <input
                  type="number"
                  min="0.01"
                  max={(order.total / 100).toFixed(2)}
                  step="0.01"
                  value={amountNaira}
                  onChange={(e) => setAmountNaira(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-gray-400 focus:outline-none"
                  autoFocus
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Refund goes to the customer's wallet immediately. Defaults to the full order total.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Cold food — customer photo attached in Slack thread #12345"
                  maxLength={300}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} disabled={mutation.isPending}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={() => mutation.mutate()} disabled={!canSend}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {mutation.isPending ? 'Refunding…' : 'Refund'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [creditOpen,  setCreditOpen]  = useState(false)
  const [refundOrder, setRefundOrder] = useState<CustomerOverview['orders'][number] | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const lookupQuery = useQuery({
    queryKey: ['support-lookup', debouncedQ],
    queryFn:  async () => {
      const res = await adminSupportApi.customerLookup(debouncedQ)
      return res.data.data
    },
    enabled: isAuthenticated && !isInitializing && debouncedQ.length >= 2,
  })

  const overviewQuery = useQuery({
    queryKey: ['support-overview', selectedId],
    queryFn:  async () => {
      if (!selectedId) return null
      const res = await adminSupportApi.customerOverview(selectedId)
      return res.data.data
    },
    enabled: !!selectedId,
  })

  const results = lookupQuery.data ?? []
  const overview = overviewQuery.data ?? null
  const selectedLabel = overview
    ? `${overview.user.firstName} ${overview.user.lastName}`
    : results.find((r) => r._id === selectedId)
      ? `${results.find((r) => r._id === selectedId)!.firstName} ${results.find((r) => r._id === selectedId)!.lastName}`
      : ''

  function pick(u: CustomerLookupResult) {
    setSelectedId(u._id)
  }

  function refreshOverview() {
    void qc.invalidateQueries({ queryKey: ['support-overview', selectedId] })
  }

  if (isInitializing || !isAuthenticated) return null

  return (
    <div>
      <PageHeader
        title="Support"
        subtitle="Look up a customer by phone, email, name, or order number. Then act — send a message, refund an order, credit their wallet."
      />

      {/* Search omnibox */}
      <div className="relative mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="+2348012345678, gerald@email.com, or GXL-1234"
          className="w-full rounded-2xl border border-gray-200 bg-white px-12 py-4 text-base text-gray-800 placeholder-gray-400 shadow-sm focus:border-gray-400 focus:outline-none"
          autoFocus
        />
        {q && (
          <button
            onClick={() => { setQ(''); setSelectedId(null) }}
            className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Results */}
        <aside className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-gray-950/[0.03]">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Results {debouncedQ && `(${results.length})`}
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {debouncedQ.length < 2 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Type at least 2 characters to search.
              </div>
            ) : lookupQuery.isLoading ? (
              <div className="p-6 text-center text-sm text-gray-500">Searching…</div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No customers match "{debouncedQ}".
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {results.map((u, idx) => (
                  <motion.li
                    key={u._id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02, duration: 0.15 }}
                  >
                    <button
                      onClick={() => pick(u)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        selectedId === u._id
                          ? 'bg-orange-50/70'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          {u.matchedVia === 'order' && (
                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
                              via order
                            </span>
                          )}
                          {!u.isActive && (
                            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
                              banned
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{u.email ?? '—'}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">{u.phone ?? '—'}</p>
                      </div>
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail */}
        <div className="min-h-[400px]">
          {!selectedId ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-6 w-6 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">Pick a customer to view their profile</p>
              <p className="mt-1 text-xs text-gray-500">Their recent orders, wallet balance, and support actions will show here.</p>
            </div>
          ) : overviewQuery.isLoading ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-sm text-gray-500">
              Loading customer overview…
            </div>
          ) : overviewQuery.isError || !overview ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 p-12 text-sm text-red-700">
              Could not load customer. Try again.
            </div>
          ) : (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Header card */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-950/[0.03]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-xl font-bold text-gray-900">
                        {overview.user.firstName} {overview.user.lastName}
                      </h2>
                      {overview.user.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">
                          Verified
                        </span>
                      )}
                      {!overview.user.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
                          Banned
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{overview.user.email ?? '—'}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500">{overview.user.phone ?? '—'}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      Customer since {new Date(overview.user.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {!overview.user.isActive && overview.user.banReason && (
                      <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-2">
                        <p className="text-xs text-red-700">
                          <strong>Banned:</strong> {overview.user.banReason}
                        </p>
                        {overview.user.bannedAt && (
                          <p className="mt-0.5 text-[10px] text-red-500">{timeAgo(overview.user.bannedAt)}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Wallet</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(overview.wallet.balance, overview.wallet.currency)}</p>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <motion.button
                    onClick={() => setContactOpen(true)}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    Contact customer
                  </motion.button>
                  <button
                    onClick={() => setCreditOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                    </svg>
                    Emergency credit
                  </button>
                </div>
              </div>

              {/* Recent orders */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-950/[0.03]">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Recent orders ({overview.orders.length})
                  </h3>
                  <Link href="/orders" className="text-[11px] font-semibold text-gray-500 hover:text-gray-900">
                    All orders →
                  </Link>
                </div>
                {overview.orders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {overview.orders.map((o) => (
                      <li key={o._id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/orders/${o._id}`} className="truncate font-mono text-sm font-semibold text-gray-900 hover:underline">
                              {o.orderNumber}
                            </Link>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusToneClasses(o.status)}`}>
                              {o.status}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {formatMoney(o.total, 'NGN')} · {timeAgo(o.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => setRefundOrder(o)}
                          className="rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-200 hover:bg-red-50"
                        >
                          Refund
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Recent disputes + refunds side by side on wide */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-950/[0.03]">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      Recent disputes ({overview.disputes.length})
                    </h3>
                    <Link href="/disputes" className="text-[11px] font-semibold text-gray-500 hover:text-gray-900">
                      All →
                    </Link>
                  </div>
                  {overview.disputes.length === 0 ? (
                    <p className="text-sm text-gray-500">None.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {overview.disputes.map((d) => (
                        <li key={d._id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-800">{d.type.replace(/_/g, ' ')}</span>
                          <span className="flex-shrink-0 text-gray-500">{timeAgo(d.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ring-1 ring-gray-950/[0.03]">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      Refund requests ({overview.refunds.length})
                    </h3>
                    <Link href="/refunds" className="text-[11px] font-semibold text-gray-500 hover:text-gray-900">
                      All →
                    </Link>
                  </div>
                  {overview.refunds.length === 0 ? (
                    <p className="text-sm text-gray-500">None.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {overview.refunds.map((r) => (
                        <li key={r._id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-800">{formatMoney(r.amountKobo, 'NGN')} · {r.status}</span>
                          <span className="flex-shrink-0 text-gray-500">{timeAgo(r.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Action modals */}
      <ContactCustomerModal
        userId={selectedId ?? ''}
        userLabel={selectedLabel}
        open={contactOpen && !!selectedId}
        onClose={() => setContactOpen(false)}
      />
      <EmergencyCreditModal
        userId={selectedId ?? ''}
        userLabel={selectedLabel}
        open={creditOpen && !!selectedId}
        onClose={() => setCreditOpen(false)}
        onDone={refreshOverview}
      />
      <ForceRefundModal
        order={refundOrder}
        open={!!refundOrder}
        onClose={() => setRefundOrder(null)}
        onDone={refreshOverview}
      />
    </div>
  )
}
