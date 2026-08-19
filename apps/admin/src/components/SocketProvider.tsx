'use client'

import { useSocket } from '../hooks/useSocket'
import { OrderAlertCard } from './OrderAlertCard'
import { RestaurantOrderModal } from './RestaurantOrderModal'
import { ConnectionBanner } from './ConnectionBanner'
import { useRestaurantAlertStore } from '../store/restaurantAlert.store'

function RestaurantModalWrapper() {
  const { pendingOrder, setPendingOrder } = useRestaurantAlertStore()
  if (!pendingOrder) return null
  return (
    <RestaurantOrderModal
      order={pendingOrder}
      onClose={() => setPendingOrder(null)}
    />
  )
}

export function SocketProvider() {
  useSocket()
  return (
    <>
      <ConnectionBanner />
      <OrderAlertCard />
      <RestaurantModalWrapper />
    </>
  )
}
