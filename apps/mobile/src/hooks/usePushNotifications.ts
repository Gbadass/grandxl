import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

const TAG = '[push]'

export function usePushNotifications(): void {
  const { isAuthenticated } = useAuthStore()
  const responseListener = useRef<Notifications.EventSubscription | undefined>(undefined)

  useEffect(() => {
    if (!isAuthenticated) {
      console.log(TAG, 'skip — not authenticated yet')
      return
    }

    async function registerForPushNotifications(): Promise<void> {
      try {
        if (!Device.isDevice) {
          console.warn(TAG, 'skip — push only works on a real device (Expo Go emulator never registers)')
          return
        }

        // Android needs a notification channel for foreground display.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name:             'Default',
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            sound:            'default',
            enableVibrate:    true,
            showBadge:        true,
          })
        }

        const { status: existing } = await Notifications.getPermissionsAsync()
        console.log(TAG, 'permission state →', existing)

        let final = existing
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync()
          final = status
          console.log(TAG, 'after request →', final)
        }
        if (final !== 'granted') {
          console.warn(TAG, 'permission denied — no push will arrive')
          return
        }

        const projectId =
          (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
          (Constants.easConfig?.projectId as string | undefined)

        if (!projectId) {
          console.error(
            TAG,
            'EXPO_PUBLIC_EAS_PROJECT_ID is not set. Without it Expo cannot mint a push token. ' +
            'Add it to apps/mobile/.env (or your env vars) and rebuild.',
          )
          return
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
        console.log(TAG, 'token →', tokenData.data)

        await usersApi.updatePushToken({ expoPushToken: tokenData.data })
        console.log(TAG, 'token registered with backend')
      } catch (err) {
        console.error(TAG, 'registration failed:', err)
      }
    }

    void registerForPushNotifications()

    // Navigate to the correct screen when a notification is tapped
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>
        if (data.screen === 'order_tracking' && data.orderId) {
          router.push(`/customer/orders/${data.orderId}/tracking`)
        } else if (data.screen === 'order_detail' && data.orderId) {
          router.push(`/customer/orders/${data.orderId}`)
        } else if (data.screen === 'rider_jobs') {
          router.push('/(rider)/')
        } else if (data.screen === 'rider_active') {
          router.push('/(rider)/active')
        }
      },
    )

    return () => {
      responseListener.current?.remove()
    }
  }, [isAuthenticated])
}
