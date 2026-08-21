import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { primeAudio, playStatusChime } from '../lib/alertSound'
import { OrderStatus } from '@grandxl/types'

const STATUS_TOASTS: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: 'Order confirmed! The restaurant is preparing it.',
  [OrderStatus.PREPARING]: 'Your food is being prepared.',
  [OrderStatus.READY]:     'Food is ready — a rider is picking it up.',
  [OrderStatus.PICKED_UP]: 'Your rider is on the way!',
  [OrderStatus.DELIVERED]: 'Delivered! Enjoy your meal.',
  [OrderStatus.CANCELLED]: 'Your order was cancelled.',
}

const RIDER_ASSIGNED_TOAST = 'A rider has accepted your order and is heading to the restaurant.'

export function useSocket(): void {
  const { isAuthenticated, accessToken } = useAuthStore()
  const qc = useQueryClient()

  // Unlock AudioContext on first gesture
  useEffect(() => {
    if (!isAuthenticated) return
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
      if (socket.connected) socket.disconnect()
      return
    }

    socket.auth = { token: accessToken }
    if (!socket.connected) socket.connect()

    function invalidateOrders(orderId?: string) {
      void qc.invalidateQueries({ queryKey: ['orders'] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      if (orderId) void qc.invalidateQueries({ queryKey: ['order', orderId] })
    }

    // Show a toast whenever order status changes — also invalidates the active
    // orders cache so the banner and order list update immediately.
    function onStatusUpdate({ orderId, status }: { orderId: string; status: string }) {
      invalidateOrders(orderId)
      const message = STATUS_TOASTS[status as OrderStatus]
      if (!message) return
      playStatusChime()
      // Stable ID deduplicates if backend emits to multiple rooms simultaneously
      toast(message, {
        id: `order-status-${status}`,
        duration: status === OrderStatus.DELIVERED || status === OrderStatus.CANCELLED ? 6000 : 5000,
      })
    }

    function onRiderAssigned({ orderId }: { orderId: string }) {
      invalidateOrders(orderId)
      playStatusChime()
      toast(RIDER_ASSIGNED_TOAST, { id: 'rider-assigned', duration: 5000 })
    }

    socket.on('order:status_update', onStatusUpdate)
    socket.on('order:rider_assigned', onRiderAssigned)

    return () => {
      socket.off('order:status_update', onStatusUpdate)
      socket.off('order:rider_assigned', onRiderAssigned)
    }
  }, [isAuthenticated, accessToken, qc])

  // Disconnect cleanly on app unmount
  useEffect(() => {
    return () => { socket.disconnect() }
  }, [])
}
