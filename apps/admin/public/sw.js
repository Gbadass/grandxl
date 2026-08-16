// GrandXL Admin — Service Worker (push notifications only)

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* bad JSON */ }

  const title = payload.title ?? 'GrandXL'
  const body  = payload.body  ?? 'You have a new notification'
  const icon  = payload.icon  ?? '/logo.png'
  const orderId = payload.data?.orderId

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/logo.png',
      data: { orderId, url: orderId ? `/restaurant/orders/${orderId}` : '/restaurant/orders' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/restaurant/orders'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin))
        if (existing) {
          existing.focus()
          existing.navigate(targetUrl)
        } else {
          self.clients.openWindow(targetUrl)
        }
      }),
  )
})
