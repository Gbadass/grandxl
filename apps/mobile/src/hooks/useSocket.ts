import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Vibration } from 'react-native'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useAuthStore } from '../store/auth.store'
import { socket } from '../lib/socket'
import { toast } from '../lib/toast'
import { UserRole } from '@grandxl/types'

export function useSocket(): void {
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const qc = useQueryClient()

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      socket.disconnect()
      return
    }

    // Attach token so gateway can verify identity on connect
    socket.auth = { token: accessToken }
    socket.connect()

    // ── Customer: order status changed ─────────────────────────────────────
    socket.on('order:status_update', ({ orderId }) => {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
    })

    // ── Customer: dispatch phase changed (searching → broadcast → no_riders) ──
    socket.on('order:dispatch_update', ({ orderId }) => {
      // Invalidate so the order detail rerenders its "Searching" banner with updated state
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
    })

    // ── Rider: new job assigned (direct) or broadcast (open pool) ─────────────
    if (user?.roles?.includes(UserRole.RIDER)) {
      socket.on('rider:new_job', ({ order }) => {
        Vibration.vibrate([0, 400, 150, 400])
        void qc.invalidateQueries({ queryKey: ['riderJobs'] })
        void qc.invalidateQueries({ queryKey: ['riderActiveOrder'] })
        // In-app toast — guaranteed to display when the app is in foreground,
        // even if expo-notifications permission/token isn't set up yet.
        toast.success(
          `New job ${order.orderNumber} · ₦${(order.pricing.deliveryFee / 100).toLocaleString('en-NG')} delivery`,
          {
            duration: 8000,
            action: { label: 'View', onPress: () => router.push('/(rider)/' as never) },
          },
        )
        void Notifications.scheduleNotificationAsync({
          content: {
            title: 'New delivery job!',
            body: `${order.orderNumber} · ₦${(order.pricing.deliveryFee / 100).toLocaleString('en-NG')} delivery fee`,
            sound: 'default',
            data: { screen: 'rider_jobs' },
          },
          trigger: null,
        })
      })

      socket.on('order:broadcast', ({ order }) => {
        Vibration.vibrate([0, 200, 100, 200, 100, 200])
        void qc.invalidateQueries({ queryKey: ['riderJobs'] })
        toast.success(
          `Job nearby · ${order.deliveryAddress.city} · ₦${(order.pricing.deliveryFee / 100).toLocaleString('en-NG')}`,
          {
            duration: 8000,
            action: { label: 'View', onPress: () => router.push('/(rider)/' as never) },
          },
        )
        void Notifications.scheduleNotificationAsync({
          content: {
            title: 'Job available near you',
            body: `${order.orderNumber} · ${order.deliveryAddress.city} · ₦${(order.pricing.deliveryFee / 100).toLocaleString('en-NG')}`,
            sound: 'default',
            data: { screen: 'rider_jobs' },
          },
          trigger: null,
        })
      })

      socket.on('rider:order_ready', () => {
        Vibration.vibrate([0, 300, 100, 300])
        void qc.invalidateQueries({ queryKey: ['riderActiveOrder'] })
        toast.info('Food is ready — head to the restaurant to pick up', {
          duration: 8000,
          action: { label: 'Go', onPress: () => router.push('/(rider)/active' as never) },
        })
        void Notifications.scheduleNotificationAsync({
          content: {
            title: '🍽 Food is ready!',
            body: 'The restaurant has packed the order. Head over to pick it up.',
            sound: 'default',
            data: { screen: 'rider_active' },
          },
          trigger: null,
        })
      })
    }

    return () => {
      socket.off('order:status_update')
      socket.off('order:dispatch_update')
      socket.off('rider:new_job')
      socket.off('order:broadcast')
      socket.off('rider:order_ready')
      socket.disconnect()
    }
  }, [isAuthenticated, accessToken, user?.roles, qc])
}
