import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── Push notifications ───────────────────────────────────────────────────────

interface PushPayload {
  title?: string
  body?: string
  icon?: string
  data?: { orderId?: string; url?: string }
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {}
  try { payload = (event.data?.json() as PushPayload) ?? {} } catch { /* bad JSON */ }

  const title   = payload.title ?? 'GrandXL'
  const body    = payload.body  ?? 'You have a new update'
  const icon    = payload.icon  ?? '/icons/icon-192.png'
  const orderId = payload.data?.orderId
  const url     = payload.data?.url ?? (orderId ? `/orders/${orderId}/tracking` : '/')

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icons/icon-192.png',
      data: { url },
      ...(orderId
        ? { actions: [{ action: 'view', title: 'Track order' }, { action: 'dismiss', title: 'Dismiss' }] }
        : {}),
    }),
  )
})

// ── Notification click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin))
        if (existing) {
          void existing.focus()
          void (existing as WindowClient).navigate(targetUrl)
        } else {
          void self.clients.openWindow(targetUrl)
        }
      }),
  )
})
