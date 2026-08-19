import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
import { playJobAlert, primeAudio } from '../lib/alertSound'
import { OrderStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'

export function useRiderSocket() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { addPendingJob, setActiveOrder, activeOrder } = useRiderStore()
  const navigate = useNavigate()
  const activeOrderRef = useRef(activeOrder)

  // Keep ref up-to-date so socket handlers always see the latest value
  useEffect(() => { activeOrderRef.current = activeOrder }, [activeOrder])

  // Unlock AudioContext on first user gesture — must happen before any job alert plays
  useEffect(() => {
    if (!isAuthenticated) return
    function unlock() { primeAudio() }
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

    // Attach fresh token before (re)connecting — required by the backend gateway
    socket.auth = { token: accessToken }

    if (!socket.connected) {
      socket.connect()
    }

    function onDirectJob({ order }: { order: Order }) {
      setActiveOrder(order)
      playJobAlert()
      toast.success(`Delivery assigned — ${order.orderNumber}`, { id: `job-${order._id}`, duration: 5000 })
      void navigate(`/delivery/${order._id}`, { replace: true })
    }

    function onBroadcastJob({ order }: { order: Order }) {
      // Adds to pendingJobs — JobOfferSheet picks it up and shows the bottom sheet
      addPendingJob(order)
      playJobAlert()
    }

    function onStatusUpdate({ orderId, status }: { orderId: string; status: OrderStatus }) {
      const current = activeOrderRef.current
      if (!current || current._id !== orderId) return

      const updated: Order = { ...current, status }
      setActiveOrder(updated)

      if (status === OrderStatus.PREPARING) {
        // Stable ID prevents duplicates if rider:order_ready also fires
        toast('Restaurant is preparing the order.', { id: `preparing-${orderId}` })
      }
      // READY is handled exclusively by onOrderReady to avoid the double-toast
      // when backend emits both order:status_update(READY) and rider:order_ready
    }

    function onOrderReady({ orderId }: { orderId: string }) {
      const current = activeOrderRef.current
      if (!current || current._id !== orderId) return
      setActiveOrder({ ...current, status: OrderStatus.READY })
      // Stable ID deduplicates against onStatusUpdate firing simultaneously
      toast.success('Food is ready — head in to pick up!', { id: `ready-${orderId}`, duration: 6000 })
    }

    socket.on('rider:new_job', onDirectJob)
    socket.on('order:broadcast', onBroadcastJob)
    socket.on('order:status_update', onStatusUpdate)
    socket.on('rider:order_ready', onOrderReady)

    return () => {
      socket.off('rider:new_job', onDirectJob)
      socket.off('order:broadcast', onBroadcastJob)
      socket.off('order:status_update', onStatusUpdate)
      socket.off('rider:order_ready', onOrderReady)
    }
  }, [isAuthenticated, accessToken, addPendingJob, setActiveOrder, navigate])
}
