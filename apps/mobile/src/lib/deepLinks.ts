// Canonical builders for in-app deep link URLs.
//
// We support two surfaces:
//   1. Custom scheme `grandxl://...` — works on any device once the app is installed.
//   2. Universal/app links `https://grandxl.com/...` — open the app if installed, fall
//      back to the web. Enabled by associatedDomains / intentFilters in app.config.js.
//
// Use these helpers anywhere you'd otherwise hardcode `grandxl://` so a future
// domain change is a one-file diff.

const SCHEME       = 'grandxl://'
const WEB_BASE     = 'https://grandxl.com'

function build(path: string): { app: string; web: string } {
  const clean = path.replace(/^\//, '')
  return {
    app: `${SCHEME}${clean}`,
    web: `${WEB_BASE}/${clean}`,
  }
}

export const deepLinks = {
  restaurant: (restaurantId: string) =>
    build(`restaurant/${restaurantId}`),

  orderDetail: (orderId: string) =>
    build(`(customer)/orders/${orderId}`),

  orderTracking: (orderId: string) =>
    build(`(customer)/orders/${orderId}/tracking`),

  wallet: () =>
    build('(customer)/profile/wallet'),

  riderActive: () =>
    build('(rider)/active'),

  riderJobs: () =>
    build('(rider)'),
}
