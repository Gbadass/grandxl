import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { disputesApi } from '@grandxl/api-client'
import type { DisputeType } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

const DISPUTE_TYPES: DisputeType[] = [
  'wrong_order',
  'missing_items',
  'late_delivery',
  'food_quality',
  'rider_conduct',
  'payment_issue',
  'other',
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DisputePage() {
  const { id: orderId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('orders')

  const [selectedType, setSelectedType] = useState<DisputeType | ''>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const descTooShort = description.trim().length > 0 && description.trim().length < 10
  const canSubmit = selectedType !== '' && description.trim().length >= 10 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !orderId) return

    setSubmitting(true)
    try {
      await disputesApi.create({
        orderId,
        type: selectedType as DisputeType,
        description: description.trim(),
      })
      setSubmitted(true)
      setTimeout(() => {
        void navigate(-1)
      }, 3000)
    } catch (err) {
      toast.error(parseApiError(err, t('dispute.submitError', 'Could not submit your report. Please try again.')))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer shrink-0"
            aria-label={t('common:back')}
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="font-display font-bold text-xl text-gray-900 leading-tight">
            {t('dispute.title')}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="mt-12 flex flex-col items-center text-center px-6"
        >
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
            {t('dispute.successTitle')}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t('dispute.successBody')}
          </p>
          <p className="text-xs text-gray-400 mt-4">
            {t('dispute.redirecting', 'Redirecting you back…')}
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer shrink-0"
          aria-label={t('common:back')}
        >
          <ChevronLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="font-display font-bold text-xl text-gray-900 leading-tight">
          {t('dispute.title')}
        </h1>
      </div>

      <AnimatePresence>
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-6"
        >
          {/* Issue type */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              {t('dispute.typeLabel')}
            </p>
            <div className="space-y-2">
              {DISPUTE_TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all duration-150 ${
                    selectedType === type
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Custom radio */}
                  <div
                    className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedType === type
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedType === type && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="disputeType"
                    value={type}
                    checked={selectedType === type}
                    onChange={() => setSelectedType(type)}
                    className="sr-only"
                  />
                  <span className="text-sm text-gray-800">
                    {t(`dispute.type.${type}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="dispute-desc">
              {t('dispute.descLabel')}
            </label>
            <textarea
              id="dispute-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dispute.descPlaceholder')}
              rows={5}
              maxLength={1000}
              className={`w-full rounded-2xl border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-gray-50 outline-none focus:ring-2 transition resize-none ${
                descTooShort
                  ? 'border-red-300 focus:ring-red-200 bg-red-50'
                  : 'border-gray-200 focus:ring-primary/30'
              }`}
            />
            <div className="flex items-center justify-between mt-1.5">
              {descTooShort ? (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle size={12} />
                  <span>
                    {t('dispute.descTooShort', 'Description must be at least 10 characters')}
                  </span>
                </div>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {description.length} / 1000
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-4 rounded-2xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ touchAction: 'manipulation', minHeight: '56px' }}
          >
            {submitting ? t('dispute.submitting') : t('dispute.submit')}
          </button>
        </motion.form>
      </AnimatePresence>
    </div>
  )
}
