import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ArrowDownLeft, ArrowUpRight, X, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { walletApi } from '@grandxl/api-client'
import type { WalletTransaction } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'

// ── Constants ──────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS_KOBO = [50_000, 100_000, 200_000, 500_000] // ₦500, ₦1000, ₦2000, ₦5000
const PAGE_SIZE = 10
const MIN_AMOUNT_KOBO = 100 // ₦1

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTxDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0)
    return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1)
    return `Yesterday · ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function BalanceSkeleton() {
  return (
    <div className="animate-pulse bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 shadow-lg">
      <div className="h-4 bg-white/30 rounded w-28 mb-6" />
      <div className="h-9 bg-white/40 rounded w-40 mb-4" />
      <div className="h-11 bg-white/20 rounded-2xl w-32" />
    </div>
  )
}

function TxSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gray-100 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
      </div>
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ tx, index }: { tx: WalletTransaction; index: number }) {
  const isCredit = tx.type === 'credit'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.2 }}
      className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
    >
      {/* Icon */}
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
          isCredit ? 'bg-green-50' : 'bg-red-50'
        }`}
      >
        {isCredit ? (
          <ArrowDownLeft size={18} className="text-green-600" />
        ) : (
          <ArrowUpRight size={18} className="text-red-500" />
        )}
      </div>

      {/* Description + date */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatTxDate(tx.createdAt)}</p>
      </div>

      {/* Amount */}
      <p
        className={`text-sm font-semibold shrink-0 ${
          isCredit ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {isCredit ? '+' : '-'}
        {formatMoney(tx.amount, 'NGN')}
      </p>
    </motion.div>
  )
}

// ── Top-up bottom sheet ───────────────────────────────────────────────────────

interface TopUpSheetProps {
  onClose: () => void
}

function TopUpSheet({ onClose }: TopUpSheetProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customAmountNaira, setCustomAmountNaira] = useState('')

  // Derived amount in kobo
  const amountKobo: number | null = (() => {
    if (customAmountNaira !== '') {
      const naira = parseFloat(customAmountNaira)
      if (!isNaN(naira) && naira >= 1) return Math.round(naira * 100)
      return null
    }
    return selectedPreset
  })()

  const isValid = amountKobo !== null && amountKobo >= MIN_AMOUNT_KOBO

  const { mutate: topUp, isPending } = useMutation({
    mutationFn: () => {
      if (!isValid || amountKobo === null) throw new Error('Invalid amount')
      const idempotencyKey = crypto.randomUUID()
      return walletApi.topUp({ amountKobo }, idempotencyKey)
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['wallet-balance'] })
      const authUrl = res.data.data.authorizationUrl
      window.location.href = authUrl
    },
    onError: () => {
      toast.error(t('wallet.topUpError', 'Could not initiate top-up. Please try again.'))
    },
  })

  function handlePresetSelect(kobo: number) {
    setSelectedPreset(kobo)
    setCustomAmountNaira('')
  }

  function handleCustomChange(val: string) {
    setCustomAmountNaira(val)
    setSelectedPreset(null)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-gray-900">
            {t('wallet.topUpTitle', 'Add money')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label={t('common.close', 'Close')}
            style={{ touchAction: 'manipulation' }}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Preset chips */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('wallet.quickAmounts', 'Quick amounts')}
        </p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PRESET_AMOUNTS_KOBO.map((kobo) => (
            <button
              key={kobo}
              onClick={() => handlePresetSelect(kobo)}
              style={{ touchAction: 'manipulation', minHeight: 44 }}
              className={`rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                selectedPreset === kobo
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatMoney(kobo, 'NGN').replace('.00', '')}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t('wallet.customAmount', 'Or enter amount')}
        </p>
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">
            ₦
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            placeholder={t('wallet.amountPlaceholder', '0.00')}
            value={customAmountNaira}
            onChange={(e) => handleCustomChange(e.target.value)}
            className="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 font-medium text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
            style={{ minHeight: 48 }}
          />
        </div>

        {/* CTA */}
        <button
          onClick={() => topUp()}
          disabled={!isValid || isPending}
          style={{ minHeight: 52, touchAction: 'manipulation' }}
          className="w-full bg-primary text-white rounded-2xl font-semibold text-base transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? t('wallet.processing', 'Processing…')
            : isValid && amountKobo !== null
            ? t('wallet.addAmount', 'Add {{amount}}', {
                amount: formatMoney(amountKobo, 'NGN'),
              })
            : t('wallet.addMoney', 'Add money')}
        </button>
      </motion.div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { t } = useTranslation()
  const [showTopUp, setShowTopUp] = useState(false)
  const [page, setPage] = useState(1)

  // Balance
  const {
    data: balanceRes,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => walletApi.getBalance(),
  })

  // Transactions — accumulate pages
  const {
    data: txRes,
    isLoading: txLoading,
    isError: txError,
    isFetching: txFetching,
  } = useQuery({
    queryKey: ['wallet-transactions', page],
    queryFn: () => walletApi.getTransactions({ page, limit: PAGE_SIZE }),
  })

  const balance = balanceRes?.data.data.balance ?? 0
  const currency = balanceRes?.data.data.currency ?? 'NGN'
  const transactions: WalletTransaction[] = txRes?.data.data.data ?? []
  const txTotal = txRes?.data.data.meta?.total ?? transactions.length
  const hasMore = transactions.length < txTotal && page * PAGE_SIZE <= txTotal

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24">

      {/* Page title */}
      <h1 className="font-display font-bold text-xl text-gray-900 mb-5">
        {t('wallet.title', 'My Wallet')}
      </h1>

      {/* ── Balance card ───────────────────────────────────────────────────── */}
      {balanceLoading ? (
        <BalanceSkeleton />
      ) : balanceError ? (
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-white shadow-lg">
          <p className="text-sm text-white/70">
            {t('wallet.balanceError', 'Could not load balance')}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-white shadow-lg"
        >
          {/* Label row */}
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-white/70" />
            <span className="text-sm font-medium text-white/80">
              {t('wallet.cardLabel', 'GrandXL Wallet')}
            </span>
          </div>

          {/* Balance */}
          <p className="text-3xl font-display font-bold tracking-tight mb-1">
            {formatMoney(balance, currency)}
          </p>
          <p className="text-xs text-white/60 mb-5">
            {t('wallet.availableBalance', 'Available balance')}
          </p>

          {/* Top-up button */}
          <button
            onClick={() => setShowTopUp(true)}
            style={{ minHeight: 44, touchAction: 'manipulation' }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 active:bg-white/25 rounded-2xl text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus size={16} />
            {t('wallet.topUp', 'Top up')}
          </button>
        </motion.div>
      )}

      {/* ── Transaction history ────────────────────────────────────────────── */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('wallet.transactionHistory', 'Transaction history')}
        </h2>

        {txLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <TxSkeleton key={i} />
            ))}
          </div>
        ) : txError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">
              {t('wallet.txError', 'Could not load transactions')}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-16 flex flex-col items-center gap-3"
          >
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Wallet size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {t('wallet.noTransactions', 'No transactions yet')}
            </p>
            <p className="text-xs text-gray-400">
              {t('wallet.noTransactionsHint', 'Top up your wallet to get started')}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`tx-page-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {transactions.map((tx, i) => (
                <TxRow key={tx._id} tx={tx} index={i} />
              ))}

              {/* Load more */}
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={txFetching}
                  style={{ minHeight: 44, touchAction: 'manipulation' }}
                  className="w-full py-3 text-sm font-medium text-primary border border-primary/30 rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {txFetching
                    ? t('common.loading', 'Loading…')
                    : t('wallet.loadMore', 'Load more')}
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Top-up bottom sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTopUp && <TopUpSheet onClose={() => setShowTopUp(false)} />}
      </AnimatePresence>
    </div>
  )
}
