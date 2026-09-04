import { useCallback, useEffect, useState } from 'react'

// S14-13: PWA install-prompt hook. Captures the browser's `beforeinstallprompt`
// event when it fires (browser has decided the site is installable and the
// user hasn't installed yet), stashes it, and exposes a `prompt()` function
// that a UI component can call to show the OS install dialog.
//
// iOS Safari doesn't fire this event — we detect standalone-display mode +
// "iOS + Safari" separately so a consumer can show a fallback "Add to Home
// Screen" hint. Not implemented here yet (deferred as follow-up).

// Non-standard Chromium event. Not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const DISMISS_KEY = 'grandxl-pwa-install-dismissed-at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isRecentlyDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return false
  const parsed = parseInt(ts, 10)
  if (Number.isNaN(parsed)) return false
  return Date.now() - parsed < DISMISS_COOLDOWN_MS
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // Chrome / Android
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // Safari iOS-specific — non-standard property, present when launched from
  // the home screen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true
  return false
}

export function usePwaInstall(): {
  canInstall: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  dismiss: () => void
} {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return
    if (isRecentlyDismissed()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Clean up if the user actually installs — Chrome fires appinstalled
    const installedHandler = () => setDeferred(null)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null) // one-shot; regardless of outcome, browser won't refire until next session
    if (outcome === 'dismissed') dismiss()
    return outcome
  }, [deferred])

  const dismiss = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setDeferred(null)
  }, [])

  return {
    canInstall: !!deferred,
    promptInstall,
    dismiss,
  }
}
