import { motion, useReducedMotion } from 'framer-motion'
import { X, ArrowDownLeft, ArrowUpRight, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import type { WalletTransaction, WalletTxnReason } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'

interface Props {
  tx: WalletTransaction
  onClose: () => void
}

function reasonLabel(reason: WalletTxnReason, t: (k: string, d: string) => string): string {
  switch (reason) {
    case 'top_up':        return t('wallet.reason.topUp',        'Top-up')
    case 'order_payment': return t('wallet.reason.orderPayment', 'Order payment')
    case 'refund':        return t('wallet.reason.refund',       'Refund')
    case 'referral':      return t('wallet.reason.referral',     'Referral reward')
    case 'promo':         return t('wallet.reason.promo',        'Promotional credit')
    case 'admin_adjust':  return t('wallet.reason.adminAdjust',  'Adjustment')
    case 'payout':        return t('wallet.reason.payout',       'Payout')
    default:              return reason
  }
}

function formatLongDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TransactionDetailSheet({ tx, onClose }: Props) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const isCredit = tx.type === 'credit'

  async function copyRef(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(t('wallet.copied', 'Copied'))
    } catch {
      toast.error(t('common.error', 'Could not copy'))
    }
  }

  return (
    <>
      <motion.div
        key="tx-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      <motion.div
        key="tx-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('wallet.txDetailTitle', 'Transaction details')}
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-gray-900">
            {t('wallet.txDetailTitle', 'Transaction details')}
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

        {/* Amount hero */}
        <div className="flex flex-col items-center mb-6">
          <div
            className={`h-14 w-14 rounded-full flex items-center justify-center mb-3 ${
              isCredit ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            {isCredit ? (
              <ArrowDownLeft size={26} className="text-green-600" />
            ) : (
              <ArrowUpRight size={26} className="text-red-500" />
            )}
          </div>
          <p
            className={`text-3xl font-display font-bold tracking-tight ${
              isCredit ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {isCredit ? '+' : '-'}
            {formatMoney(tx.amount, 'NGN')}
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatLongDate(tx.createdAt)}</p>
        </div>

        {/* Details */}
        <dl className="space-y-3 border-t border-gray-100 pt-4">
          <Row
            label={t('wallet.reasonLabel', 'Reason')}
            value={reasonLabel(tx.reason, t)}
          />

          {tx.description && (
            <Row
              label={t('wallet.descriptionLabel', 'Description')}
              value={tx.description}
            />
          )}

          <Row
            label={t('wallet.balanceBefore', 'Balance before')}
            value={formatMoney(tx.balanceBefore, 'NGN')}
          />

          <Row
            label={t('wallet.balanceAfter', 'Balance after')}
            value={formatMoney(tx.balanceAfter, 'NGN')}
          />

          {tx.referenceType && tx.referenceId && (
            <div className="flex items-start justify-between gap-3 py-2">
              <dt className="text-sm text-gray-500 shrink-0">
                {t('wallet.reference', 'Reference')}
              </dt>
              <dd className="text-right min-w-0">
                <button
                  onClick={() => copyRef(tx.referenceId!)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 cursor-pointer hover:text-primary transition-colors"
                  aria-label={t('wallet.copyReference', 'Copy reference')}
                >
                  <span className="capitalize truncate max-w-[180px]">
                    {tx.referenceType.replace('_', ' ')}
                  </span>
                  <Copy size={13} className="text-gray-400 shrink-0" />
                </button>
                <p className="text-[11px] text-gray-400 font-mono truncate max-w-[180px]">
                  {tx.referenceId}
                </p>
              </dd>
            </div>
          )}

          <Row
            label={t('wallet.txId', 'Transaction ID')}
            value={tx._id}
            mono
            copyable
            onCopy={() => copyRef(tx._id)}
          />
        </dl>
      </motion.div>
    </>
  )
}

function Row({
  label,
  value,
  mono,
  copyable,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd
        className={`text-sm font-medium text-gray-900 text-right min-w-0 ${
          mono ? 'font-mono text-[11px] truncate max-w-[180px]' : ''
        }`}
      >
        {copyable ? (
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors max-w-full"
          >
            <span className="truncate">{value}</span>
            <Copy size={12} className="text-gray-400 shrink-0" />
          </button>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}
