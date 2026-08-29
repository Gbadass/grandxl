import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { walletApi } from '@grandxl/api-client'
import { formatMoney, parseApiError } from '@grandxl/utils'

const PRESET_AMOUNTS_KOBO = [50_000, 100_000, 200_000, 500_000] // ₦500, ₦1000, ₦2000, ₦5000
const MIN_AMOUNT_KOBO = 100 // ₦1

interface TopUpSheetProps {
  onClose: () => void
  /**
   * Optional starting amount in kobo. When provided (e.g. from checkout with
   * an insufficient-balance shortfall), the sheet pre-selects a preset if one
   * matches or fills the custom input with the shortfall converted to naira.
   */
  suggestedKobo?: number
}

export function TopUpSheet({ onClose, suggestedKobo }: TopUpSheetProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()

  const initialPreset = suggestedKobo && PRESET_AMOUNTS_KOBO.includes(suggestedKobo) ? suggestedKobo : null
  const initialCustom =
    suggestedKobo && !initialPreset
      ? String(Math.ceil(suggestedKobo / 100)) // round up to nearest naira
      : ''

  const [selectedPreset, setSelectedPreset] = useState<number | null>(initialPreset)
  const [customAmountNaira, setCustomAmountNaira] = useState(initialCustom)

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
    onError: (err: unknown) => {
      toast.error(parseApiError(err, t('wallet.topUpError', 'Could not initiate top-up. Please try again.')))
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
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      <motion.div
        key="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('wallet.topUpTitle', 'Add money')}
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        transition={reduceMotion ? { duration: 0.15 } : { type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

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
