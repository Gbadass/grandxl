'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/auth.store'
import { socket } from '../lib/socket'
import { playNewOrderChime, primeAudio } from '../lib/alertSound'
import { requestNotificationPermission, showBrowserNotification } from '../lib/browserNotification'

export function useSocket(): void {
  const { isAuthenticated, accessToken } = useAuthStore()
  const qc = useQueryClient()

  // First-mount setup: unlock AudioContext on next user gesture, ask for
  // notification permission once.
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

    // New order placed → refresh table, chime, toast, browser notification, bell.
    socket.on('order:new', ({ order }) => {
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })

      playNewOrderChime()
      toast.success(`New order #${order.orderNumber} received!`, {
        duration: 6000,
        icon: '🛎️',
      })
      showBrowserNotification(`New order · ${order.orderNumber}`, {
        body: `${order.items?.length ?? 0} item${order.items?.length === 1 ? '' : 's'} · tap to view`,
        tag: `order-${order._id}`,
        requireInteraction: true,
        onClick: () => window.location.assign(`/restaurant/orders/${order._id}`),
      })
    })

    // Order status updated → refresh detail and list
    socket.on('order:status_update', ({ orderId }) => {
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    })

    // Rider was matched to this order — refresh so the live card can flip from
    // "Finding a rider" to the rider info chip with name, distance, ETA.
    socket.on('order:rider_assigned', ({ orderId }) => {
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
      toast.success('A rider accepted the job!', { icon: '🛵', duration: 4000 })
    })

    return () => {
      socket.off('order:new')
      socket.off('order:status_update')
      socket.off('order:rider_assigned')
      socket.disconnect()
    }
  }, [isAuthenticated, accessToken, qc])
}
