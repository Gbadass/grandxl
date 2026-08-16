import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
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
      // Direct assignment — no need to "accept", rider is already assigned
      setActiveOrder(order)
      toast.success(`New delivery! Head to the restaurant — ${order.orderNumber}`)
      void navigate(`/delivery/${order._id}`, { replace: true })
    }

    function onBroadcastJob({ order }: { order: Order }) {
      addPendingJob(order)
      toast(`New job nearby — ${order.orderNumber}`, { icon: '📦' })
    }

    function onStatusUpdate({ orderId, status }: { orderId: string; status: OrderStatus }) {
      const current = activeOrderRef.current
      if (!current || current._id !== orderId) return

      const updated: Order = { ...current, status }
      setActiveOrder(updated)

      if (status === OrderStatus.READY) {
        toast.success('Food is ready! Go pick it up.')
      } else if (status === OrderStatus.PREPARING) {
        toast('Restaurant is preparing the order.', { icon: '🍳' })
      }
    }

    function onOrderReady({ orderId }: { orderId: string }) {
      const current = activeOrderRef.current
      if (!current || current._id !== orderId) return
      setActiveOrder({ ...current, status: OrderStatus.READY })
      toast.success('Food is ready — head in to pick up!')
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
