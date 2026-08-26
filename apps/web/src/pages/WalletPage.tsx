import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Wallet, ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { walletApi } from '@grandxl/api-client'
import type { WalletTransaction } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { TopUpSheet } from '../features/wallet/components/TopUpSheet'
import { TransactionDetailSheet } from '../features/wallet/components/TransactionDetailSheet'

const PAGE_SIZE = 10

type Filter = 'all' | 'credit' | 'debit'

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

function TxRow({
  tx,
  index,
  onOpen,
}: {
  tx: WalletTransaction
  index: number
  onOpen: () => void
}) {
  const isCredit = tx.type === 'credit'

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.2 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
      style={{ touchAction: 'manipulation' }}
    >
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

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {tx.description ?? tx.reason.replace('_', ' ')}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{formatTxDate(tx.createdAt)}</p>
      </div>

      <p
        className={`text-sm font-semibold shrink-0 ${
          isCredit ? 'text-green-600' : 'text-red-500'
        }`}
      >
        {isCredit ? '+' : '-'}
        {formatMoney(tx.amount, 'NGN')}
      </p>
    </motion.button>
  )
}

function FilterChips({
  value,
  onChange,
}: {
  value: Filter
  onChange: (v: Filter) => void
}) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()

  const options: { key: Filter; label: string }[] = [
    { key: 'all',    label: t('wallet.filterAll',    'All') },
    { key: 'credit', label: t('wallet.filterCredits', 'Credits') },
    { key: 'debit',  label: t('wallet.filterDebits',  'Debits') },
  ]

  return (
    <div
      role="tablist"
      aria-label={t('wallet.filterLabel', 'Filter transactions')}
      className="flex gap-2 mb-4"
    >
      {options.map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            style={{ touchAction: 'manipulation', minHeight: 36 }}
            className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              active ? 'text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {active && (
              <motion.span
                layoutId={reduceMotion ? undefined : 'wallet-filter-pill'}
                className="absolute inset-0 bg-primary rounded-full shadow-sm"
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function WalletPage() {
  const { t } = useTranslation()
  const [showTopUp, setShowTopUp] = useState(false)
  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const {
    data: balanceRes,
    isLoading: balanceLoading,
    isError: balanceError,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => walletApi.getBalance(),
  })

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
  const allTx: WalletTransaction[] = txRes?.data.data.data ?? []
  const txTotal = txRes?.data.data.meta?.total ?? allTx.length
  const hasMore = allTx.length < txTotal && page * PAGE_SIZE <= txTotal

  const transactions = useMemo(
    () => (filter === 'all' ? allTx : allTx.filter((tx) => tx.type === filter)),
    [allTx, filter],
  )

  const emptyCopy: { title: string; hint: string } = (() => {
    if (filter === 'credit')
      return {
        title: t('wallet.noCredits', 'No credits yet'),
        hint:  t('wallet.noCreditsHint', 'Top-ups, refunds and rewards will appear here'),
      }
    if (filter === 'debit')
      return {
        title: t('wallet.noDebits', 'No debits yet'),
        hint:  t('wallet.noDebitsHint', 'Payments made from your wallet will appear here'),
      }
    return {
      title: t('wallet.noTransactions', 'No transactions yet'),
      hint:  t('wallet.noTransactionsHint', 'Top up your wallet to get started'),
    }
  })()

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
      <h1 className="font-display font-bold text-xl text-gray-900 mb-5">
        {t('wallet.title', 'My Wallet')}
      </h1>

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
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-white/70" />
            <span className="text-sm font-medium text-white/80">
              {t('wallet.cardLabel', 'GrandXL Wallet')}
            </span>
          </div>

          <p className="text-3xl font-display font-bold tracking-tight mb-1">
            {formatMoney(balance, currency)}
          </p>
          <p className="text-xs text-white/60 mb-5">
            {t('wallet.availableBalance', 'Available balance')}
          </p>

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

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('wallet.transactionHistory', 'Transaction history')}
        </h2>

        <FilterChips value={filter} onChange={setFilter} />

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
            <p className="text-sm font-medium text-gray-700">{emptyCopy.title}</p>
            <p className="text-xs text-gray-400 text-center px-6">{emptyCopy.hint}</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`tx-${filter}-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {transactions.map((tx, i) => (
                <TxRow
                  key={tx._id}
                  tx={tx}
                  index={i}
                  onOpen={() => setDetailTx(tx)}
                />
              ))}

              {hasMore && filter === 'all' && (
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

      <AnimatePresence>
        {showTopUp && <TopUpSheet onClose={() => setShowTopUp(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {detailTx && (
          <TransactionDetailSheet tx={detailTx} onClose={() => setDetailTx(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
