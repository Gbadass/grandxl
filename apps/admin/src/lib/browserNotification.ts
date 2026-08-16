/**
 * Thin wrapper around the Web Notifications API so we fall back gracefully
 * in browsers that don't support it (or where the user denied permission).
 */

export function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Ask the user once. Idempotent — if they've already chosen, returns the
 * existing permission without prompting again.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!supportsNotifications()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * Fire a native browser notification. Best effort — silent no-op if the user
 * hasn't granted permission or the page is currently focused (toast suffices then).
 */
export function showBrowserNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void },
): void {
  if (!supportsNotifications()) return
  if (Notification.permission !== 'granted') return
  // Only show when the tab is hidden — otherwise the in-page toast is enough.
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

  try {
    const n = new Notification(title, {
      icon: '/logo.png',
      badge: '/logo.png',
      ...options,
    })
    if (options?.onClick) n.onclick = () => { window.focus(); options.onClick?.(); n.close() }
  } catch {
    // Some browsers throw if called outside a user gesture context; ignore.
  }
}
