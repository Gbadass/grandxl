import { AnimatePresence, motion } from 'framer-motion'

// S14-2: Shared confirmation sheet — replaces the native `window.confirm()`
// scattered across a few flows (cart-clear on restaurant switch is the first
// consumer; more Sprint 14 confirms will follow).
//
// Bottom-sheet layout on mobile (thumb-reachable), centred card on ≥sm.
// Backdrop tap = cancel. Escape isn't wired here because parents typically
// unmount the sheet on the destructive/primary action anyway.

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'primary'
}

export function ConfirmSheet({
  open, title, description, confirmLabel, cancelLabel, onConfirm, onCancel, variant = 'primary',
}: Props) {
  const confirmBg = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
    : 'bg-primary hover:bg-primary/90 active:bg-primary/95'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[2px]"
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            // Mobile: slide up from bottom. Desktop (sm+): centred fade+spring.
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[9999] mx-auto w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6"
            role="alertdialog"
            aria-labelledby="confirm-sheet-title"
            aria-describedby={description ? 'confirm-sheet-desc' : undefined}
          >
            {/* Grab handle — mobile-only visual affordance */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden />

            <h2 id="confirm-sheet-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id="confirm-sheet-desc" className="mt-2 text-sm leading-relaxed text-gray-500">
                {description}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <motion.button
                type="button"
                onClick={onCancel}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.08 }}
                className="w-full cursor-pointer rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
                style={{ touchAction: 'manipulation' }}
              >
                {cancelLabel}
              </motion.button>
              <motion.button
                type="button"
                onClick={onConfirm}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.08 }}
                className={`w-full cursor-pointer rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-sm sm:w-auto ${confirmBg}`}
                style={{ touchAction: 'manipulation' }}
                autoFocus
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
