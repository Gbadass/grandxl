// S14-11: print-optimized receipt for a delivered order. Route: /orders/:id/receipt.
// Design goals:
//  - No app chrome (no nav, no bottom tabs) — just the receipt
//  - "Print / Save as PDF" button uses the browser's native print dialog, which
//    modern browsers (Chrome, Safari, Firefox) offer "Save as PDF" from
//  - @media print CSS strips the header buttons so the printed page is clean
//  - Works for any order the user can access (server-side auth via existing
//    ordersApi.getById endpoint)

import { useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Printer } from 'lucide-react'
import { ordersApi } from '@grandxl/api-client'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'

export default function OrderReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(['orders', 'common'])
  const { isAuthenticated } = useAuthStore()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  })

  // Set the tab title for the print output — browsers use it as the PDF filename.
  useEffect(() => {
    if (data?.orderNumber) {
      const prev = document.title
      document.title = `GrandXL Receipt · ${data.orderNumber}`
      return () => { document.title = prev }
    }
    return undefined
  }, [data?.orderNumber])

  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} state={{ returnTo: `/orders/${id}/receipt` }} replace />

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        {t('common:loading')}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-sm text-gray-500">{t('common:error')}</p>
        <button onClick={() => navigate(-1)} className="text-primary underline">{t('common:back')}</button>
      </div>
    )
  }

  const order = data
  const createdAt = new Date(order.createdAt).toLocaleString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      {/* Print-only styles — hides the header actions on printed page. Applied
          inline via style tag so it doesn't need a global stylesheet edit. */}
      <style>{`
        @media print {
          .receipt-print-hide { display: none !important; }
          body { background: white !important; }
          .receipt-page { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-6 px-4">
        {/* Header actions — hidden on print */}
        <div className="receipt-print-hide max-w-2xl mx-auto mb-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft size={16} /> {t('common:back')}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <Printer size={15} strokeWidth={2.3} />
            {t('orders:receipt.printSave')}
          </button>
        </div>

        {/* Receipt paper */}
        <div className="receipt-page max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-8 print:shadow-none">
          <header className="pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">GrandXL</h1>
            <p className="text-xs text-gray-500 mt-0.5">{t('orders:receipt.tagline')}</p>
          </header>

          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-400 uppercase tracking-wide">{t('orders:receipt.orderNumber')}</p>
              <p className="mt-0.5 font-mono font-semibold text-gray-900">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide">{t('orders:receipt.orderDate')}</p>
              <p className="mt-0.5 text-gray-900">{createdAt}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide">{t('orders:receipt.status')}</p>
              <p className="mt-0.5 text-gray-900 capitalize">{order.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-400 uppercase tracking-wide">{t('orders:receipt.payment')}</p>
              <p className="mt-0.5 text-gray-900">{order.payment.method} · {order.payment.status}</p>
            </div>
          </div>

          {/* Delivery address */}
          <section className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('orders:receipt.deliveredTo')}</p>
            <p className="mt-1 text-sm text-gray-800">
              {order.deliveryAddress?.street}
              {order.deliveryAddress?.city ? `, ${order.deliveryAddress.city}` : ''}
              {order.deliveryAddress?.state ? `, ${order.deliveryAddress.state}` : ''}
            </p>
          </section>

          {/* Items */}
          <section className="mt-6 pt-4 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('orders:receipt.items')}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-1 font-medium">{t('orders:receipt.item')}</th>
                  <th className="py-1 font-medium text-center">{t('orders:receipt.qty')}</th>
                  <th className="py-1 font-medium text-right">{t('orders:receipt.total')}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-2">
                      <p className="text-gray-800">{it.name}</p>
                      {(it.selectedVariants?.length ?? 0) > 0 && (
                        <p className="text-[10px] text-gray-500">
                          {it.selectedVariants!.map((v) => `${v.variantName}: ${v.optionName}`).join(' · ')}
                        </p>
                      )}
                      {it.note && <p className="text-[10px] text-gray-400 italic">"{it.note}"</p>}
                    </td>
                    <td className="py-2 text-center text-gray-800 tabular-nums">{it.quantity}</td>
                    <td className="py-2 text-right text-gray-900 tabular-nums font-medium">
                      {formatMoney(it.itemTotal, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Totals */}
          <section className="mt-6 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
            <Row label={t('orders:receipt.subtotal')} value={formatMoney(order.pricing.subtotal, order.currency)} />
            {order.pricing.deliveryFee > 0 && (
              <Row label={t('orders:receipt.deliveryFee')} value={formatMoney(order.pricing.deliveryFee, order.currency)} />
            )}
            {order.pricing.serviceFee > 0 && (
              <Row label={t('orders:receipt.serviceFee')} value={formatMoney(order.pricing.serviceFee, order.currency)} />
            )}
            {(order.pricing.discount ?? 0) > 0 && (
              <Row label={t('orders:receipt.discount')} value={`-${formatMoney(order.pricing.discount, order.currency)}`} valueClass="text-emerald-700" />
            )}
            {(order.pricing.tip ?? 0) > 0 && (
              <Row label={t('orders:receipt.tip')} value={formatMoney(order.pricing.tip, order.currency)} />
            )}
            <div className="pt-2 border-t border-gray-200">
              <Row
                label={t('orders:receipt.grandTotal')}
                value={formatMoney(order.pricing.total, order.currency)}
                bold
              />
            </div>
          </section>

          <footer className="mt-8 pt-4 border-t border-gray-100 text-[11px] text-gray-400 text-center">
            <p>{t('orders:receipt.thanks')}</p>
            <p className="mt-0.5">grandxl.com</p>
          </footer>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold text-gray-900' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}
