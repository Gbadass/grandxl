import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { socket } from '../lib/socket'
import axiosInstance from '../lib/axios'
import { ridersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'
import { useRiderStore } from '../store/rider.store'
import { primeAudio } from '../lib/alertSound'
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

    // Always disconnect then reconnect so the gateway re-authenticates with the
    // current token. Merely updating socket.auth on a live connection is not enough
    // because the gateway checks token expiry on every inbound message — a stale
    // token causes all location updates and room joins to be rejected with 401.
    socket.auth = { token: accessToken }
    socket.disconnect()
    socket.connect()

    function onDirectJob({ order }: { order: Order }) {
      // Treat admin-assigned jobs the same as broadcasts — rider must explicitly accept.
      // JobOfferSheet manages the looping alert and accept/decline UI.
      addPendingJob(order)
    }

    function onBroadcastJob({ order }: { order: Order }) {
      // Adds to pendingJobs — JobOfferSheet picks it up, shows the sheet, and loops the alert.
      addPendingJob(order)
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

    // Reconcile local activeOrder with server after any reconnect. Covers the case
    // where an accept HTTP call succeeded on the server but the ack never reached us
    // (network drop mid-accept), leaving local state stale. Also catches cases where
    // an order was assigned via admin push while we were disconnected.
    function reconcileActiveJob() {
      ridersApi.getActiveJob()
        .then((res) => {
          const serverActive = res.data.data
          const localActive = useRiderStore.getState().activeOrder
          if (serverActive && (!localActive || localActive._id !== serverActive._id)) {
            // Server sees an order we don't know about — adopt it
            useRiderStore.getState().setActiveOrder(serverActive)
            toast('Reconnected — restored your active delivery.', { id: 'active-restored' })
          } else if (!serverActive && localActive) {
            // We think we're on a delivery but server disagrees. Trust the server —
            // the order was likely cancelled or reassigned while we were offline.
            useRiderStore.getState().setActiveOrder(null)
            toast('Your active job is no longer assigned to you.', { id: 'active-lost' })
          }
        })
        .catch(() => undefined)
    }

    function onServerDisconnect(reason: string) {
      // "io server disconnect" = the gateway rejected or kicked our socket.
      // Most common cause: access token expired while rider was idle (no HTTP
      // calls to trigger the axios interceptor's silent refresh).
      // Fix: make one authenticated call → the 401 fires the interceptor →
      // interceptor refreshes the token → setAuth updates accessToken in the
      // store → this useEffect re-runs → socket reconnects with the fresh token.
      if (reason === 'io server disconnect') {
        void axiosInstance.get('/riders/me').catch(() => {
          // Interceptor handled it — either we got a new token (reconnect will
          // happen automatically) or the session was truly dead (clearAuth →
          // isAuthenticated = false → socket stays disconnected).
        })
      }
    }

    socket.on('rider:new_job', onDirectJob)
    socket.on('order:broadcast', onBroadcastJob)
    socket.on('order:status_update', onStatusUpdate)
    socket.on('rider:order_ready', onOrderReady)
    socket.on('disconnect', onServerDisconnect)
    // Reconcile on every successful (re)connect. Not just reconnects — the initial
    // connect after a boot may find an order that was assigned while offline.
    socket.on('connect', reconcileActiveJob)

    return () => {
      socket.off('rider:new_job', onDirectJob)
      socket.off('order:broadcast', onBroadcastJob)
      socket.off('order:status_update', onStatusUpdate)
      socket.off('rider:order_ready', onOrderReady)
      socket.off('disconnect', onServerDisconnect)
      socket.off('connect', reconcileActiveJob)
      socket.disconnect()
    }
  }, [isAuthenticated, accessToken, addPendingJob, setActiveOrder, navigate])
}
