import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSocketStatus } from '../../hooks/useSocketStatus'

// S14-4: thin status bar at the top of the viewport that surfaces socket
// connection issues to the customer. Three states:
//   - 'reconnecting' → amber "Reconnecting…" with pulse spinner
//   - 'offline'      → red    "You're offline. Live updates are paused."
//   - just-reconnected → green "Back online" that auto-hides after 2s
//
// Rendered once at the app root. Sits ABOVE any nav/content via a high z-index
// (5000). Uses env(safe-area-inset-top) so it doesn't hide under the iOS notch.

export function SocketStatusBanner() {
  const status = useSocketStatus()
  const { t } = useTranslation('common')
  // Track whether we've EVER been disconnected, so the "back online" flash
  // only fires after a real interruption — not on first page load.
  const [showBackOnline, setShowBackOnline] = useState(false)
  const [wasDown, setWasDown] = useState(false)

  useEffect(() => {
    if (status === 'reconnecting' || status === 'offline') {
      setWasDown(true)
      setShowBackOnline(false)
      return undefined
    }
    if (status === 'connected' && wasDown) {
      setShowBackOnline(true)
      const t = setTimeout(() => setShowBackOnline(false), 2000)
      return () => clearTimeout(t)
    }
    return undefined
  }, [status, wasDown])

  // What to render — either a live problem banner, or the transient
  // recovery flash, or nothing.
  const kind: 'down' | 'off' | 'back' | null =
    status === 'reconnecting' ? 'down' :
    status === 'offline'      ? 'off' :
    showBackOnline            ? 'back' :
    null

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          key={kind}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          className={`fixed inset-x-0 top-0 z-[5000] flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold shadow-sm ${
            kind === 'down' ? 'bg-amber-100 text-amber-900'
            : kind === 'off' ? 'bg-red-100 text-red-900'
            : 'bg-emerald-100 text-emerald-900'
          }`}
          style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}
          role="status"
          aria-live="polite"
        >
          {kind === 'down' && (
            <>
              <span
                className="relative inline-flex h-2 w-2"
                aria-hidden
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
              </span>
              {t('socket.reconnecting', 'Reconnecting…')}
            </>
          )}
          {kind === 'off' && (
            <>
              <WifiOff size={14} strokeWidth={2.3} aria-hidden />
              {t('socket.offline', "You're offline. Live updates are paused.")}
            </>
          )}
          {kind === 'back' && (
            <>
              <Wifi size={14} strokeWidth={2.3} aria-hidden />
              {t('socket.backOnline', 'Back online')}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
