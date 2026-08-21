import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Building2, Pencil, X, CheckCircle2, Search, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { riderPayoutsApi } from '@grandxl/api-client'
import type { BankAccount, NigerianBank, PayoutRequest } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'

// ─── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.22 },
  }),
}

const sheetVariants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring' as const, damping: 28, stiffness: 280 } },
  exit: { y: '100%', transition: { duration: 0.22, ease: 'easeIn' as const } },
}

// ─── Status pill ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PayoutRequest['status'], string> = {
  pending:  'bg-yellow-500/15 text-yellow-400',
  approved: 'bg-blue-500/15 text-blue-400',
  paid:     'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
}

function StatusPill({ status }: { status: PayoutRequest['status'] }) {
  const { t } = useTranslation('rider')
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {t(`payout_status_${status}`)}
    </span>
  )
}

// ─── Bank account form (Paystack-verified) ───────────────────────────────────

interface BankFormProps {
  initial: BankAccount | null
  onSaved: () => void
  onCancel?: () => void
}

function BankAccountForm({ initial, onSaved, onCancel }: BankFormProps) {
  const { t } = useTranslation('rider')
  const queryClient = useQueryClient()

  // Step 1 — bank selection
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(
    initial?.bankCode ? { id: 0, name: initial.bankName ?? '', code: initial.bankCode } : null,
  )
  const [bankSearch, setBankSearch] = useState(initial?.bankName ?? '')
  const [showBankList, setShowBankList] = useState(false)
  const bankInputRef = useRef<HTMLInputElement>(null)

  // Step 2 — account number
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? '')

  // Step 3 — resolved account name from Paystack
  const [resolvedName, setResolvedName] = useState<string | null>(initial?.accountName ?? null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  // Step 4 — save
  const [saving, setSaving] = useState(false)

  // Banks list from our backend (which proxies Paystack)
  const { data: banks = [] } = useQuery({
    queryKey: ['nigerian-banks'],
    queryFn: () => riderPayoutsApi.getBanks().then((r) => r.data.data),
    staleTime: 1000 * 60 * 60, // 1 hour — bank list rarely changes
  })

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase()),
  )

  // Auto-resolve when bank + 10-digit account number are both set
  useEffect(() => {
    if (!selectedBank || accountNumber.length !== 10) {
      setResolvedName(null)
      setResolveError(null)
      return
    }
    let cancelled = false
    setResolving(true)
    setResolveError(null)
    setResolvedName(null)
    riderPayoutsApi
      .verifyAccount(accountNumber, selectedBank.code)
      .then((r) => {
        if (!cancelled) setResolvedName(r.data.data.accountName)
      })
      .catch(() => {
        if (!cancelled)
          setResolveError(t('bank_account_not_found'))
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => { cancelled = true }
  }, [selectedBank, accountNumber])

  const canSave = selectedBank !== null && accountNumber.length === 10 && resolvedName !== null

  async function handleSave() {
    if (!canSave || saving || !selectedBank || !resolvedName) return
    setSaving(true)
    try {
      await riderPayoutsApi.updateBankAccount({
        bankName:      selectedBank.name,
        accountNumber,
        accountName:   resolvedName,
        bankCode:      selectedBank.code,
      })
      await queryClient.invalidateQueries({ queryKey: ['rider-bank-account'] })
      toast.success(t('bank_account_saved'))
      onSaved()
    } catch {
      toast.error(t('bank_account_save_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Bank selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('bank_label')}</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
            <Search size={14} className="text-zinc-500" />
          </div>
          <input
            ref={bankInputRef}
            type="text"
            value={bankSearch}
            onChange={(e) => {
              setBankSearch(e.target.value)
              setSelectedBank(null)
              setShowBankList(true)
            }}
            onFocus={() => setShowBankList(true)}
            placeholder={t('bank_search_placeholder')}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary"
            style={{ minHeight: '48px' }}
          />
          {selectedBank && (
            <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
              <CheckCircle2 size={16} className="text-green-400" />
            </div>
          )}
        </div>

        {/* Dropdown list */}
        <AnimatePresence>
          {showBankList && filteredBanks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800 shadow-xl"
            >
              {filteredBanks.slice(0, 20).map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => {
                    setSelectedBank(bank)
                    setBankSearch(bank.name)
                    setShowBankList(false)
                    setAccountNumber('')
                    setResolvedName(null)
                  }}
                  className="w-full cursor-pointer px-4 py-2.5 text-left text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  {bank.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Account number */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">{t('account_number_label')}</label>
        <input
          type="text"
          inputMode="numeric"
          value={accountNumber}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 10)
            setAccountNumber(val)
          }}
          placeholder={t('account_number_placeholder')}
          disabled={!selectedBank}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-primary disabled:opacity-40"
          style={{ minHeight: '48px' }}
        />
        {accountNumber.length > 0 && accountNumber.length < 10 && (
          <p className="mt-1 text-[11px] text-zinc-500">{t('more_digits', { count: 10 - accountNumber.length })}</p>
        )}
      </div>

      {/* Resolved account name */}
      <AnimatePresence mode="wait">
        {resolving && (
          <motion.div
            key="resolving"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3"
          >
            <Loader2 size={15} className="animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-400">{t('verifying_account')}</span>
          </motion.div>
        )}

        {resolvedName && !resolving && (
          <motion.div
            key="resolved"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3"
          >
            <CheckCircle2 size={18} className="shrink-0 text-green-400" />
            <div>
              <p className="text-xs text-green-500">{t('account_verified')}</p>
              <p className="font-semibold text-sm text-green-300">{resolvedName}</p>
            </div>
          </motion.div>
        )}

        {resolveError && !resolving && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {resolveError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2.5 pt-1">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-600"
            style={{ touchAction: 'manipulation', minHeight: '48px' }}
          >
            {t('cancel_btn')}
          </button>
        )}
        <button
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
          className="flex-1 cursor-pointer rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ touchAction: 'manipulation', minHeight: '48px' }}
        >
          {saving ? t('saving') : t('confirm_account')}
        </button>
      </div>
    </div>
  )
}

// ─── Payout history row ──────────────────────────────────────────────────────

function PayoutRow({ item }: { item: PayoutRequest }) {
  const date = new Date(item.createdAt).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-zinc-800/60 last:border-0">
      <div>
        <p className="text-sm font-semibold text-zinc-100">
          {formatMoney(item.amountKobo, 'NGN')}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">{date}</p>
      </div>
      <StatusPill status={item.status} />
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const { t } = useTranslation('rider')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { rider, setRider } = useRiderStore()

  const pendingKobo = rider?.earnings.pendingKobo ?? 0

  // Bank account query
  const {
    data: bankAccount,
    isLoading: loadingBank,
  } = useQuery({
    queryKey: ['rider-bank-account'],
    queryFn: () => riderPayoutsApi.getBankAccount().then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  // Payout history query
  const [historyPage, setHistoryPage] = useState(1)
  const {
    data: historyData,
    isLoading: loadingHistory,
    isFetching: fetchingMore,
  } = useQuery({
    queryKey: ['rider-payouts', historyPage],
    queryFn: () => riderPayoutsApi.list({ page: historyPage, limit: 10 }).then((r) => r.data.data),
    staleTime: 1000 * 60,
  })

  // Accumulated rows across pages
  const [allItems, setAllItems] = useState<PayoutRequest[]>([])
  const [loadedPages, setLoadedPages] = useState<number[]>([])

  // Merge incoming page into allItems (avoid dupes)
  if (
    historyData?.items &&
    !loadedPages.includes(historyData.page)
  ) {
    setLoadedPages((prev) => [...prev, historyData.page])
    setAllItems((prev) => {
      const existingIds = new Set(prev.map((i) => i._id))
      const fresh = historyData.items.filter((i) => !existingIds.has(i._id))
      return [...prev, ...fresh]
    })
  }

  const hasMore = historyData ? historyPage < historyData.pages : false

  // UI state
  const [editingBank, setEditingBank] = useState(false)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const hasBankAccount =
    bankAccount !== null &&
    bankAccount !== undefined &&
    bankAccount.bankName !== null &&
    bankAccount.accountNumber !== null &&
    bankAccount.accountName !== null

  const canRequestPayout = pendingKobo > 0 && hasBankAccount

  // Mask account number: show only last 4 digits
  function maskAccount(num: string | null): string {
    if (!num) return '****'
    return `****${num.slice(-4)}`
  }

  async function confirmPayout() {
    if (requesting) return
    setRequesting(true)
    try {
      await riderPayoutsApi.request(pendingKobo)
      // Invalidate profile so pendingKobo resets
      await queryClient.invalidateQueries({ queryKey: ['rider-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['rider-payouts'] })
      // Optimistically zero out store
      if (rider) {
        setRider({ ...rider, earnings: { ...rider.earnings, pendingKobo: 0 } })
      }
      // Reset history accumulator
      setAllItems([])
      setLoadedPages([])
      setHistoryPage(1)
      toast.success(t('payout_submitted'))
      setShowConfirmSheet(false)
    } catch {
      toast.error(t('payout_submit_error'))
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="relative min-h-full bg-zinc-950 px-4 py-4 pb-10">
      {/* Back button */}
      <button
        onClick={() => void navigate(-1)}
        className="mb-6 flex cursor-pointer items-center gap-1 text-sm text-zinc-400"
        style={{ touchAction: 'manipulation', minHeight: '40px' }}
      >
        <ChevronLeft size={18} />
        {t('common:back')}
      </button>

      <h1 className="mb-6 font-display text-lg font-bold text-zinc-100">
        {t('payouts')}
      </h1>

      {/* ── Section 1: Pending balance ─────────────────────────────── */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center"
      >
        <p className="mb-1 text-sm text-zinc-400">{t('earnings_pending')}</p>
        <p className="mb-1 font-display text-3xl font-bold text-primary">
          {formatMoney(pendingKobo, 'NGN')}
        </p>
        <p className="mb-5 text-xs text-zinc-600">{t('available_for_payout')}</p>

        {!loadingBank && !hasBankAccount ? (
          <p className="rounded-xl bg-yellow-500/10 px-4 py-2.5 text-xs font-medium text-yellow-400">
            {t('setup_bank_first')}
          </p>
        ) : (
          <button
            onClick={() => setShowConfirmSheet(true)}
            disabled={!canRequestPayout}
            className="w-full cursor-pointer rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
            style={{ touchAction: 'manipulation', minHeight: '48px' }}
          >
            {t('request_payout')}
          </button>
        )}
      </motion.div>

      {/* ── Section 2: Bank account ────────────────────────────────── */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-300">{t('bank_account_title')}</p>
          </div>
          {hasBankAccount && !editingBank && (
            <button
              onClick={() => setEditingBank(true)}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              style={{ touchAction: 'manipulation', minHeight: '36px' }}
            >
              <Pencil size={13} />
              {t('edit_btn')}
            </button>
          )}
          {editingBank && (
            <button
              onClick={() => setEditingBank(false)}
              className="flex cursor-pointer items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              style={{ touchAction: 'manipulation', minHeight: '36px' }}
            >
              <X size={14} />
              {t('close_label')}
            </button>
          )}
        </div>

        {loadingBank ? (
          <div className="space-y-2">
            <div className="h-5 w-2/3 animate-pulse rounded-lg bg-zinc-800" />
            <div className="h-4 w-1/2 animate-pulse rounded-lg bg-zinc-800" />
          </div>
        ) : hasBankAccount && !editingBank ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{t('bank_label')}</span>
              <span className="text-sm font-medium text-zinc-200">{bankAccount!.bankName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{t('account_no_label')}</span>
              <span className="font-mono text-sm font-semibold tracking-widest text-zinc-200">
                {maskAccount(bankAccount!.accountNumber)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">{t('account_name_label')}</span>
              <span className="text-sm font-medium text-zinc-200">{bankAccount!.accountName}</span>
            </div>
          </div>
        ) : editingBank ? (
          <BankAccountForm
            initial={bankAccount ?? null}
            onSaved={() => setEditingBank(false)}
            onCancel={() => setEditingBank(false)}
          />
        ) : (
          /* No bank account yet */
          <div>
            <p className="mb-4 text-sm text-zinc-500">
              {t('add_bank_account_desc')}
            </p>
            <BankAccountForm
              initial={null}
              onSaved={() => { /* stay on page, query invalidation will refresh */ }}
            />
          </div>
        )}
      </motion.div>

      {/* ── Section 4: Payout history ──────────────────────────────── */}
      <motion.div
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      >
        <p className="mb-3 text-sm font-semibold text-zinc-300">
          {t('payout_history')}
        </p>

        {loadingHistory && allItems.length === 0 ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="space-y-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                  <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-600">
            {t('no_payout_requests')}
          </p>
        ) : (
          <>
            <div>
              {allItems.map((item) => (
                <PayoutRow key={item._id} item={item} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={fetchingMore}
                className="mt-4 w-full cursor-pointer rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
                style={{ touchAction: 'manipulation', minHeight: '44px' }}
              >
                {fetchingMore ? t('loading') : t('load_more')}
              </button>
            )}
          </>
        )}
      </motion.div>

      {/* ── Section 3: Confirm payout bottom sheet ─────────────────── */}
      <AnimatePresence>
        {showConfirmSheet && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmSheet(false)}
              className="fixed inset-0 z-40 bg-black/60"
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              variants={sheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-zinc-900 px-5 pb-10 pt-5"
            >
              {/* Drag handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />

              <div className="mb-1 flex items-center justify-between">
                <p className="font-display text-base font-bold text-zinc-100">
                  {t('confirm_payout_title')}
                </p>
                <button
                  onClick={() => setShowConfirmSheet(false)}
                  className="cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Amount */}
              <div className="my-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center">
                <p className="mb-1 text-xs text-zinc-500">{t('amount_to_request')}</p>
                <p className="font-display text-3xl font-bold text-primary">
                  {formatMoney(pendingKobo, 'NGN')}
                </p>
              </div>

              {/* Bank destination */}
              {hasBankAccount && (
                <div className="mb-5 flex items-center gap-3 rounded-xl bg-zinc-800/60 px-4 py-3">
                  <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {bankAccount!.bankName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {maskAccount(bankAccount!.accountNumber)} &middot; {bankAccount!.accountName}
                    </p>
                  </div>
                </div>
              )}

              <p className="mb-5 text-center text-xs text-zinc-500">
                {t('payout_processing_time')}
              </p>

              <button
                onClick={() => void confirmPayout()}
                disabled={requesting}
                className="w-full cursor-pointer rounded-xl bg-primary py-3.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ touchAction: 'manipulation', minHeight: '52px' }}
              >
                {requesting ? t('submitting') : t('confirm_payout_title')}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
