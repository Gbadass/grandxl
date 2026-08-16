import { useEffect, useRef } from 'react'
import { notificationsApi, usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function useWebPush() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || subscribedRef.current) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function subscribe() {
      try {
        const registration = await navigator.serviceWorker.ready

        // Check if already subscribed
        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          // Re-save on every login in case the user cleared the backend record
          const sub = existing.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
          await usersApi.saveWebPushSubscription(sub).catch(() => undefined)
          subscribedRef.current = true
          return
        }

        // Request permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Fetch VAPID public key
        const keyRes = await notificationsApi.getVapidPublicKey()
        const vapidKey = keyRes.data.data?.publicKey
        if (!vapidKey) return

        const keyBytes = urlBase64ToUint8Array(vapidKey)
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer as ArrayBuffer,
        })

        const subJson = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        await usersApi.saveWebPushSubscription(subJson)
        subscribedRef.current = true
      } catch {
        // Silently ignore — push is optional enhancement
      }
    }

    void subscribe()
  }, [isAuthenticated])
}
