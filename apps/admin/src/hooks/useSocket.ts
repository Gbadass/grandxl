'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { socket } from '../lib/socket'
import { playNewOrderChime, primeAudio, startLoopAlarm, stopLoopAlarm } from '../lib/alertSound'
import { requestNotificationPermission, showBrowserNotification } from '../lib/browserNotification'
import { useAlertStore } from '../store/alert.store'
import { useRestaurantAlertStore } from '../store/restaurantAlert.store'
import { UserRole } from '@grandxl/types'

export function useSocket(): void {
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const qc = useQueryClient()
  const addOrder = useAlertStore((s) => s.addOrder)
  const setPendingOrder = useRestaurantAlertStore((s) => s.setPendingOrder)

  const isRestaurantOwner = user?.roles?.includes(UserRole.RESTAURANT_OWNER) ?? false
  const isSuperAdmin     = user?.roles?.includes(UserRole.SUPER_ADMIN)      ?? false

  // Unlock AudioContext + request notification permission on first user gesture
  useEffect(() => {
    if (!isAuthenticated) return
    void requestNotificationPermission()

    function unlock() {
      primeAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      socket.disconnect()
      return
    }

    socket.auth = { token: accessToken }
    socket.connect()

    function invalidateLiveOrders() {
      void qc.invalidateQueries({ queryKey: ['my-orders-live'] })
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
    }

    // Named handlers — always pass the same reference to socket.off() so we only
    // remove OUR listener and never strip other components' listeners (e.g. ConnectionBanner)
    function onConnect() {
      invalidateLiveOrders()
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    }

    function onNewOrder({ order }: { order: import('@grandxl/types').Order }) {
      if (!order) return
      invalidateLiveOrders()
      void qc.invalidateQueries({ queryKey: ['notifications'] })

      if (isRestaurantOwner) {
        // Guard against duplicate events: a user with both RESTAURANT_OWNER and
        // SUPER_ADMIN roles joins two socket rooms and would receive order:new twice.
        const current = useRestaurantAlertStore.getState().pendingOrder
        if (current?._id?.toString() === order._id?.toString()) return
        setPendingOrder(order)
        startLoopAlarm()
        showBrowserNotification(`New order · ${order.orderNumber}`, {
          body: `${order.items?.length ?? 0} item${order.items?.length === 1 ? '' : 's'} — tap to respond`,
          tag:  `order-${order._id}`,
          requireInteraction: true,
          onClick: () => {
            stopLoopAlarm()
            window.location.assign(`/restaurant/orders/${order._id}`)
          },
        })
        return
      }

      if (isSuperAdmin) {
        addOrder(order)
        playNewOrderChime()
        showBrowserNotification(`New order · ${order.orderNumber}`, {
          body: `${order.items?.length ?? 0} item${order.items?.length === 1 ? '' : 's'} · tap to view`,
          tag:  `order-${order._id}`,
          requireInteraction: true,
          onClick: () => window.location.assign(`/orders/${order._id}`),
        })
      }
    }

    function onStatusUpdate({ orderId, status }: { orderId: string; status: string }) {
      invalidateLiveOrders()
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      // Fallback dismissal: when rider accepts, assignRider auto-advances the order
      // to PREPARING and fires order:status_update. Dismiss the modal here too so
      // the restaurant isn't stuck waiting for order:rider_assigned if it arrives first.
      if (isRestaurantOwner && status && status !== 'pending' && status !== 'confirmed') {
        const currentPending = useRestaurantAlertStore.getState().pendingOrder
        if (currentPending?._id?.toString() === orderId) {
          stopLoopAlarm()
          setPendingOrder(null)
        }
      }
    }

    function onRiderAssigned({ orderId }: { orderId: string }) {
      invalidateLiveOrders()
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
      if (isRestaurantOwner) {
        const currentPending = useRestaurantAlertStore.getState().pendingOrder
        if (currentPending?._id?.toString() === orderId) {
          stopLoopAlarm()
          setPendingOrder(null)
        }
        toast.success('Rider accepted — on the way to pick up!', {
          id: `rider-accepted-${orderId}`,
          duration: 5000,
        })
      }
    }

    socket.on('connect', onConnect)
    socket.on('order:new', onNewOrder)
    socket.on('order:status_update', onStatusUpdate)
    socket.on('order:rider_assigned', onRiderAssigned)

    return () => {
      socket.off('connect', onConnect)
      socket.off('order:new', onNewOrder)
      socket.off('order:status_update', onStatusUpdate)
      socket.off('order:rider_assigned', onRiderAssigned)
      socket.disconnect()
    }
  }, [isAuthenticated, accessToken, isRestaurantOwner, isSuperAdmin, qc, addOrder, setPendingOrder])
}
