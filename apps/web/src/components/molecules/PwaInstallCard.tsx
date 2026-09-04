import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePwaInstall } from '../../hooks/usePwaInstall'

// S14-13: dismissable install-prompt card. Renders only when the browser has
// fired `beforeinstallprompt` (i.e., site is installable + user hasn't
// installed + hasn't dismissed within 7 days). Sits above the home content,
// slides in with a spring, out with a fade. Two actions: Install (fires the
// native OS dialog) or Not now (7-day cooldown).

export function PwaInstallCard() {
  const { canInstall, promptInstall, dismiss } = usePwaInstall()
  const { t } = useTranslation('common')

  return (
    <AnimatePresence>
      {canInstall && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="mx-4 mt-3 rounded-2xl bg-gradient-to-r from-primary/95 to-primary/85 text-white shadow-lg overflow-hidden"
        >
          <div className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Download size={18} strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">
                {t('pwa.title', 'Install GrandXL')}
              </p>
              <p className="mt-0.5 text-xs text-white/85 leading-snug">
                {t('pwa.subtitle', 'One-tap access, faster orders, works offline.')}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('pwa.dismiss', 'Not now')}
              className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              style={{ touchAction: 'manipulation' }}
            >
              <X size={16} strokeWidth={2.3} />
            </button>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <motion.button
              type="button"
              onClick={() => void promptInstall()}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.08 }}
              className="flex-1 rounded-xl bg-white text-primary text-sm font-bold py-2.5 cursor-pointer hover:bg-white/95"
              style={{ touchAction: 'manipulation' }}
            >
              {t('pwa.install', 'Install app')}
            </motion.button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 cursor-pointer"
              style={{ touchAction: 'manipulation' }}
            >
              {t('pwa.later', 'Later')}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
