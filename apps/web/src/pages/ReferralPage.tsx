import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Copy, Check, Share2, Users, Gift, ChevronRight, Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { referralsApi } from '@grandxl/api-client'
import { formatMoney, parseApiError } from '@grandxl/utils'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4 max-w-2xl mx-auto px-4 py-5 pb-24">
      <div className="h-6 bg-zinc-800 rounded w-40 mb-6" />
      <div className="bg-zinc-900 rounded-3xl p-6 space-y-4">
        <div className="h-4 bg-zinc-800 rounded w-28" />
        <div className="h-14 bg-zinc-800 rounded-2xl" />
        <div className="h-12 bg-zinc-800 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 rounded-2xl p-4 h-20" />
        <div className="bg-zinc-900 rounded-2xl p-4 h-20" />
      </div>
    </div>
  )
}

// ── How it works step ─────────────────────────────────────────────────────────

interface StepProps {
  number: number
  title: string
  description: string
  delay: number
}

function HowItWorksStep({ number, title, description, delay }: StepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex items-start gap-4"
    >
      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-sm font-bold text-primary">{number}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferralPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [applyInput, setApplyInput] = useState('')

  const {
    data: res,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['referral-info'],
    queryFn: () => referralsApi.getMyInfo(),
  })

  const info = res?.data?.data

  const applyMutation = useMutation({
    mutationFn: (code: string) => referralsApi.applyCode(code.trim().toUpperCase()),
    onSuccess: () => {
      toast.success(t('referral.applied', 'Referral code applied!'))
      setApplyInput('')
      void qc.invalidateQueries({ queryKey: ['referral-info'] })
    },
    onError: (err: unknown) => {
      toast.error(parseApiError(err, t('referral.applyError', 'Could not apply code — check and try again')))
    },
  })

  // ── Copy to clipboard ─────────────────────────────────────────────────────

  async function handleCopy() {
    const code = info?.referralCode
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('referral.copied', 'Code copied!'))
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error(t('referral.copyError', 'Could not copy — please copy the code manually'))
    }
  }

  // ── Native share ──────────────────────────────────────────────────────────

  async function handleShare() {
    const code = info?.referralCode
    if (!code) return
    const shareText = t(
      'referral.shareText',
      'Use my code {{code}} on GrandXL and get ₦500 off your first order! Download at grandxl.com',
      { code },
    )
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('referral.shareTitle', 'Join GrandXL'), text: shareText })
      } catch {
        // User cancelled share or browser denied — fall back to copy
        await handleCopy()
      }
    } else {
      // Fallback: copy the message
      try {
        await navigator.clipboard.writeText(shareText)
        toast.success(t('referral.shareCopied', 'Share text copied to clipboard!'))
      } catch {
        toast.error(t('referral.shareError', 'Sharing not available on this device'))
      }
    }
  }

  if (isLoading) return <PageSkeleton />

  if (isError || !info) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-zinc-400 text-sm">
          {t('referral.loadError', 'Could not load your referral info. Please try again.')}
        </p>
      </div>
    )
  }

  const { referralCode, referralCount, totalEarnedKobo } = info

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24 bg-zinc-950 min-h-screen">

      {/* Page title */}
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="font-display font-bold text-xl text-zinc-100 mb-6"
      >
        {t('referral.pageTitle', 'Refer & Earn')}
      </motion.h1>

      {/* ── Hero card ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-primary/20 to-orange-500/10 border border-primary/20 rounded-3xl p-6 mb-4"
      >
        {/* Headline */}
        <div className="flex items-center gap-2 mb-1">
          <Gift size={18} className="text-primary" />
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">
            {t('referral.heroLabel', 'Earn ₦500 per friend')}
          </p>
        </div>
        <p className="text-zinc-300 text-sm mb-5">
          {t(
            'referral.heroDesc',
            'Share your code. When your friend completes their first order, you both win.',
          )}
        </p>

        {/* Code box */}
        {referralCode ? (
          <button
            onClick={() => void handleCopy()}
            aria-label={t('referral.copyCode', 'Copy referral code')}
            style={{ touchAction: 'manipulation', minHeight: 56 }}
            className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-950/60 border border-zinc-700 rounded-2xl group hover:border-primary/50 transition-colors cursor-pointer mb-3"
          >
            <span className="font-mono text-2xl font-bold tracking-widest text-zinc-100 select-all">
              {referralCode}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 group-hover:text-primary transition-colors">
              {copied ? (
                <>
                  <Check size={14} className="text-green-400" />
                  <span className="text-green-400 font-medium">
                    {t('referral.copiedLabel', 'Copied!')}
                  </span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>{t('referral.tapToCopy', 'Tap to copy')}</span>
                </>
              )}
            </div>
          </button>
        ) : (
          <div
            className="w-full px-5 py-3.5 bg-zinc-950/60 border border-zinc-700 rounded-2xl mb-3"
            style={{ minHeight: 56 }}
          >
            <p className="text-zinc-500 text-sm text-center">
              {t('referral.noCode', 'Your referral code is being generated…')}
            </p>
          </div>
        )}

        {/* Share button */}
        <button
          onClick={() => void handleShare()}
          style={{ minHeight: 48, touchAction: 'manipulation' }}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-2xl font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 cursor-pointer"
        >
          <Share2 size={16} />
          {t('referral.shareButton', 'Share with friends')}
        </button>
      </motion.div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.25 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-400">
              {t('referral.friendsReferred', 'Friends referred')}
            </p>
          </div>
          <p className="text-2xl font-bold font-display text-zinc-100">{referralCount}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Gift size={14} className="text-zinc-400" />
            <p className="text-xs text-zinc-400">
              {t('referral.totalEarned', 'Total earned')}
            </p>
          </div>
          <p className="text-2xl font-bold font-display text-zinc-100">
            {formatMoney(totalEarnedKobo, 'NGN')}
          </p>
        </motion.div>
      </div>

      {/* ── Apply a code (only if they haven't already) ──────────────────────── */}
      {!info.hasAppliedCode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.25 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Ticket size={14} className="text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-200">
              {t('referral.applyTitle', 'Have a referral code?')}
            </p>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            {t('referral.applyDesc', 'Apply a friend\'s code and they earn ₦500 after your first order.')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={applyInput}
              onChange={(e) => setApplyInput(e.target.value.toUpperCase())}
              placeholder={t('referral.applyPlaceholder', 'ENTER CODE')}
              disabled={applyMutation.isPending}
              maxLength={16}
              className="flex-1 bg-zinc-950 border border-zinc-700 text-zinc-100 rounded-2xl px-4 text-sm font-mono tracking-wider focus:outline-none focus:border-primary/60 disabled:opacity-50"
              style={{ minHeight: 48 }}
            />
            <button
              onClick={() => applyMutation.mutate(applyInput)}
              disabled={applyMutation.isPending || applyInput.trim().length < 4}
              className="bg-primary text-white rounded-2xl px-5 text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{ minHeight: 48, touchAction: 'manipulation' }}
            >
              {applyMutation.isPending ? '…' : t('referral.apply', 'Apply')}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.25 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <ChevronRight size={14} className="text-zinc-500" />
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {t('referral.howItWorks', 'How it works')}
          </p>
        </div>

        <div className="space-y-4">
          <HowItWorksStep
            number={1}
            title={t('referral.step1Title', 'Share your code')}
            description={t(
              'referral.step1Desc',
              'Send your unique code to a friend who hasn\'t tried GrandXL yet.',
            )}
            delay={0.25}
          />
          <div className="h-px bg-zinc-800" />
          <HowItWorksStep
            number={2}
            title={t('referral.step2Title', 'Friend places their first order')}
            description={t(
              'referral.step2Desc',
              'Your friend signs up with your code and completes their first delivery.',
            )}
            delay={0.3}
          />
          <div className="h-px bg-zinc-800" />
          <HowItWorksStep
            number={3}
            title={t('referral.step3Title', 'You earn ₦500')}
            description={t(
              'referral.step3Desc',
              '₦500 is credited to your GrandXL wallet automatically — no action needed.',
            )}
            delay={0.35}
          />
        </div>
      </motion.div>
    </div>
  )
}
