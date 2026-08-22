import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { reviewsApi } from '@grandxl/api-client'

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReviewSheetProps {
  orderId: string
  riderId: string | null
  isOpen: boolean
  onClose: () => void
}

// ── Star Rating ───────────────────────────────────────────────────────────────

interface StarRatingProps {
  label: string
  value: number
  onChange: (v: number) => void
  required?: boolean
  error?: boolean
}

function StarRating({ label, value, onChange, required, error }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)
  const { t } = useTranslation('orders')

  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 -mx-3 transition-colors ${error ? 'bg-red-50 ring-1 ring-red-200' : ''}`}>
      <span className={`text-sm font-medium ${error ? 'text-red-600' : 'text-gray-700'}`}>
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || value)
          return (
            <button
              key={star}
              type="button"
              className="cursor-pointer p-0.5 transition-transform active:scale-90"
              style={{ touchAction: 'manipulation' }}
              onMouseEnter={() => setHovered(star)}
              onClick={() => onChange(star)}
              aria-label={star === 1 ? t('review.rateStar', { count: star }) : t('review.rateStarPlural', { count: star })}
            >
              <Star
                size={28}
                className={
                  filled
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-200'
                }
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Success State ─────────────────────────────────────────────────────────────

function SuccessView() {
  const { t } = useTranslation('orders')
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="flex flex-col items-center justify-center py-10 gap-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center"
      >
        <CheckCircle2 size={44} className="text-green-500" />
      </motion.div>
      <div className="text-center">
        <p className="font-display font-bold text-lg text-gray-900">{t('review.thankYou')}</p>
        <p className="text-sm text-gray-400 mt-1">{t('review.thankYouSub')}</p>
      </div>
    </motion.div>
  )
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

export function ReviewSheet({ orderId, riderId, isOpen, onClose }: ReviewSheetProps) {
  const [foodRating, setFoodRating]             = useState(0)
  const [restaurantRating, setRestaurantRating] = useState(0)
  const [riderRating, setRiderRating]           = useState(0)
  const [comment, setComment]                   = useState('')
  const [isPending, setIsPending]               = useState(false)
  const [submitted, setSubmitted]               = useState(false)
  const [restaurantError, setRestaurantError]   = useState(false)
  const { t } = useTranslation('orders')

  const hasRider = riderId !== null

  async function handleSubmit() {
    if (restaurantRating === 0) {
      setRestaurantError(true)
      toast.error(t('review.ratingRequired'))
      return
    }

    setIsPending(true)
    try {
      await reviewsApi.create({
        orderId,
        restaurantRating,
        ...(foodRating > 0      ? { foodRating }  : {}),
        ...(hasRider && riderRating > 0 ? { riderRating } : {}),
        ...(comment.trim()      ? { comment: comment.trim() } : {}),
      })
      setSubmitted(true)
      // Auto-close after brief success animation
      setTimeout(() => {
        onClose()
        // Reset for potential re-use
        setSubmitted(false)
        setFoodRating(0)
        setRestaurantRating(0)
        setRiderRating(0)
        setRestaurantError(false)
        setComment('')
      }, 1800)
    } catch {
      toast.error(t('review.submitError'))
    } finally {
      setIsPending(false)
    }
  }

  function handleClose() {
    onClose()
    setSubmitted(false)
    setFoodRating(0)
    setRestaurantRating(0)
    setRiderRating(0)
    setRestaurantError(false)
    setComment('')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-8 max-w-2xl mx-auto"
          >
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gray-200" />

            <AnimatePresence mode="wait">
              {submitted ? (
                <SuccessView key="success" />
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-xl text-gray-900">
                      {t('review.title')}
                    </h2>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="p-2 rounded-full hover:bg-gray-100 cursor-pointer transition-colors"
                      aria-label={t('common:close')}
                    >
                      <X size={18} className="text-gray-500" />
                    </button>
                  </div>

                  {/* Ratings */}
                  <div className="space-y-5 mb-6">
                    <StarRating
                      label={t('review.foodQuality')}
                      value={foodRating}
                      onChange={setFoodRating}
                    />
                    <StarRating
                      label={t('review.restaurantLabel')}
                      value={restaurantRating}
                      onChange={(v) => { setRestaurantRating(v); setRestaurantError(false) }}
                      required
                      error={restaurantError}
                    />
                    {hasRider && (
                      <StarRating
                        label={t('review.delivery')}
                        value={riderRating}
                        onChange={setRiderRating}
                      />
                    )}
                  </div>

                  {/* Comment */}
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('review.placeholder')}
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 outline-none resize-none transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary mb-5"
                  />

                  {/* Actions */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => void handleSubmit()}
                    disabled={isPending}
                    className="w-full bg-primary text-white rounded-2xl font-semibold text-base cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ minHeight: '56px', touchAction: 'manipulation' }}
                  >
                    {isPending && (
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    )}
                    {isPending ? t('review.submitting') : t('review.submit')}
                  </motion.button>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full mt-3 py-2 text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    {t('review.skip')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
