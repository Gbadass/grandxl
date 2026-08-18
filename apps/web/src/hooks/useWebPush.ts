import { useEffect } from 'react'
import { notificationsApi, usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export function useWebPush() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready

        // Already subscribed — nothing to do
        const existing = await reg.pushManager.getSubscription()
        if (existing) return

        const { data } = await notificationsApi.getVapidPublicKey()
        const applicationServerKey = urlBase64ToUint8Array(data.data.publicKey)

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        })

        const json = subscription.toJSON()
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

        await usersApi.saveWebPushSubscription({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        })
      } catch {
        // Permission denied or push unsupported — fail silently
      }
    })()
  }, [user])
}
