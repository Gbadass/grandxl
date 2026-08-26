import type { Order } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'

// HTML escape — the order fields are user-provided (item notes, customer note,
// delivery instructions) so we can't trust them inside innerHTML.
function esc(v: string | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString('en-NG', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// Builds a self-contained HTML document sized for an 80mm thermal printer,
// but degrades gracefully on A4 (max-width caps the content column). No
// external CSS, no fonts, no JS beyond the auto-print / auto-close hook.
function buildTicketHtml(order: Order, restaurantName: string): string {
  const itemsHtml = order.items
    .map((item) => {
      const variants = item.selectedVariants.length
        ? `<div class="sub">${item.selectedVariants.map((v) => `${esc(v.variantName)}: ${esc(v.optionName)}`).join(', ')}</div>`
        : ''
      const addons = item.selectedAddOns.length
        ? `<div class="sub">+ ${item.selectedAddOns.map((a) => esc(a.name)).join(', ')}</div>`
        : ''
      const note = item.note ? `<div class="note">✎ ${esc(item.note)}</div>` : ''
      return `
        <div class="line">
          <div class="qty">${item.quantity}×</div>
          <div class="name">
            <div class="title">${esc(item.name)}</div>
            ${variants}
            ${addons}
            ${note}
          </div>
        </div>`
    })
    .join('')

  const customerNote = order.customerNote
    ? `<div class="box"><strong>Note to restaurant:</strong> ${esc(order.customerNote)}</div>`
    : ''

  const deliveryInstructions = order.deliveryInstructions
    ? `<div class="row"><strong>Instructions:</strong> ${esc(order.deliveryInstructions)}</div>`
    : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Order ${esc(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body {
    font: 12px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    margin: 0;
    padding: 8px;
    color: #000;
    background: #fff;
    max-width: 320px;
  }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2px; letter-spacing: 1px; }
  .brand-sub { text-align: center; font-size: 11px; margin-bottom: 8px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; font-size: 12px; }
  .row strong { font-weight: 700; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    text-align: center;
    margin: 6px 0 4px;
  }
  .line {
    display: flex;
    gap: 6px;
    padding: 4px 0;
    border-bottom: 1px dotted #ccc;
  }
  .line:last-child { border-bottom: 0; }
  .qty { font-weight: 700; min-width: 24px; }
  .name { flex: 1; }
  .title { font-weight: 600; }
  .sub { font-size: 11px; color: #333; margin-top: 1px; }
  .note { font-size: 11px; font-style: italic; margin-top: 2px; }
  .box {
    border: 1px solid #000;
    padding: 5px 6px;
    margin-top: 6px;
    font-size: 11px;
  }
  .total {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
    margin-top: 4px;
  }
  .foot { text-align: center; font-size: 10px; margin-top: 10px; color: #333; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <h1>GRANDXL</h1>
  <div class="brand-sub">${esc(restaurantName)}</div>
  <div class="sep"></div>

  <div class="row"><strong>Order</strong><span>${esc(order.orderNumber)}</span></div>
  <div class="row"><strong>Placed</strong><span>${esc(fmtDate(order.createdAt))}</span></div>
  <div class="row"><strong>Status</strong><span>${esc(order.status)}</span></div>
  <div class="row"><strong>Payment</strong><span>${esc(order.payment.method)} · ${esc(order.payment.status)}</span></div>

  <div class="sep"></div>
  <div class="section-title">Items</div>
  ${itemsHtml}

  ${customerNote}

  <div class="sep"></div>
  <div class="section-title">Delivery</div>
  <div class="row"><span>${esc(order.deliveryAddress.street)}</span></div>
  <div class="row"><span>${esc(order.deliveryAddress.city)}, ${esc(order.deliveryAddress.state)}</span></div>
  ${deliveryInstructions}

  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${esc(formatMoney(order.pricing.subtotal, order.currency))}</span></div>
  <div class="row"><span>Delivery fee</span><span>${esc(formatMoney(order.pricing.deliveryFee, order.currency))}</span></div>
  <div class="row"><span>Service fee</span><span>${esc(formatMoney(order.pricing.serviceFee, order.currency))}</span></div>
  ${order.pricing.discount > 0
    ? `<div class="row"><span>Discount</span><span>-${esc(formatMoney(order.pricing.discount, order.currency))}</span></div>`
    : ''}
  ${order.pricing.tip > 0
    ? `<div class="row"><span>Rider tip</span><span>${esc(formatMoney(order.pricing.tip, order.currency))}</span></div>`
    : ''}
  <div class="sep"></div>
  <div class="total"><span>TOTAL</span><span>${esc(formatMoney(order.pricing.total, order.currency))}</span></div>

  <div class="foot">Printed ${esc(fmtDate(new Date()))}</div>

<script>
  window.addEventListener('load', function () {
    window.focus();
    setTimeout(function () {
      window.print();
    }, 100);
  });
  // After the print dialog closes (or is cancelled) the window can auto-close
  // — but only on the parent's action, since some browsers block a scripted
  // close of a window that the user opened. We just leave it and the operator
  // closes the tab when done.
</script>
</body>
</html>`
}

/**
 * Opens a new window with a print-ready 80mm receipt for the given order and
 * triggers the browser's print dialog. Returns false if the popup was blocked.
 */
export function printOrderTicket(order: Order, restaurantName: string): boolean {
  const html = buildTicketHtml(order, restaurantName)
  const win = window.open('', '_blank', 'width=380,height=760')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  return true
}
