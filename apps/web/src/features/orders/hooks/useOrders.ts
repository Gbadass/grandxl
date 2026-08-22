import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@grandxl/api-client'
import { OrderStatus, PaymentMethod, PaymentStatus } from '@grandxl/types'
import type { Order } from '@grandxl/types'

export const ACTIVE_STATUSES = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.PICKED_UP,
]

// A PENDING Paystack order means "waiting for payment" — the popup is open or the
// user navigated away. These are ghost orders (not yet paid) and should be invisible
// to the customer until the webhook confirms payment and advances the order to CONFIRMED.
// Cash/wallet PENDING orders ARE real — the restaurant is waiting to confirm them.
function isActiveForBanner(order: Order): boolean {
  if (!ACTIVE_STATUSES.includes(order.status)) return false
  if (
    order.status === OrderStatus.PENDING &&
    order.payment.method === PaymentMethod.PAYSTACK &&
    order.payment.status !== PaymentStatus.COMPLETED
  ) {
    return false
  }
  return true
}

export type OrderTab = 'all' | 'active' | 'delivered' | 'cancelled'

function resolveParams(tab: OrderTab, page: number): { page: number; limit: number; status?: OrderStatus } {
  const base = { page, limit: 15 }
  if (tab === 'delivered') return { ...base, status: OrderStatus.DELIVERED }
  if (tab === 'cancelled') return { ...base, status: OrderStatus.CANCELLED }
  return base
}

export function useInvalidateOrders() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['orders'] })
}

export function useActiveOrders() {
  return useQuery({
    queryKey: ['orders', 'active'],
    queryFn: () =>
      ordersApi.getHistory({ page: 1, limit: 20 }).then((r) => {
        const all: Order[] = r.data.data.data
        return all.filter(isActiveForBanner)
      }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
  })
}

export function useOrdersList(tab: OrderTab, page = 1) {
  const params = resolveParams(tab, page)
  return useQuery({
    queryKey: ['orders', 'list', tab, page],
    queryFn: () =>
      ordersApi.getHistory(params).then((r) => {
        const all: Order[] = r.data.data.data
        const data = tab === 'active'
          ? all.filter((o) => ACTIVE_STATUSES.includes(o.status))
          : all
        return { data, meta: r.data.data.meta }
      }),
    staleTime: tab === 'active' ? 0 : 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: tab === 'active',
    refetchInterval: tab === 'active' ? 15_000 : false,
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getById(id).then((r) => r.data.data),
    enabled: Boolean(id),
    staleTime: 1000 * 10,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false
      const status = query.state.data?.status
      const done = status === 'delivered' || status === 'cancelled'
      return done ? false : 1000 * 15
    },
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'response' in error) {
        const status = (error as { response?: { status?: number } }).response?.status
        if (status === 401 || status === 403 || status === 404) return false
      }
      return failureCount < 2
    },
  })
}

// Legacy — still used by CheckoutPage first-order check
export function useOrderHistory(page = 1) {
  return useQuery({
    queryKey: ['orders', 'history', page],
    queryFn: () =>
      ordersApi.getHistory({ page, limit: 20 }).then((r) => {
        const all: Order[] = r.data.data.data
        return {
          data: all.filter((o) => !ACTIVE_STATUSES.includes(o.status)),
          meta: r.data.data.meta,
        }
      }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
