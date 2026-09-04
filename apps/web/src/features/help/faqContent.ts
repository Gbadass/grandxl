// S14-12: FAQ content lives here so it's git-versioned and translatable.
// If ops needs to update copy frequently, this can migrate to a CMS or the
// platform-config module later — the shape is stable.

export interface FaqItem {
  q: string
  a: string
}

export interface FaqCategory {
  id: string
  icon: 'orders' | 'payments' | 'delivery' | 'account' | 'restaurants'
  titleKey: string   // i18n key
  items: FaqItem[]
}

// Content is intentionally in English inline for MVP shipping. i18n keys can
// replace the strings without changing the shape of consumers. Categories
// ordered by expected support volume (orders > payments > delivery > …).
export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'orders',
    icon: 'orders',
    titleKey: 'help.category.orders',
    items: [
      {
        q: "How do I cancel an order?",
        a: "You can cancel an order from the tracking page as long as the restaurant hasn't started preparing it. Once preparation begins, cancellation requires contacting support. Open the order → tap 'Cancel order' at the bottom.",
      },
      {
        q: "My order is late. What can I do?",
        a: "The tracking page shows a live ETA that updates as your rider gets closer. If your order is significantly late (30+ minutes past ETA), open the order and tap 'Report a problem' to escalate to our support team.",
      },
      {
        q: "How do I reorder something I've had before?",
        a: "Go to My Orders, find the past order, and tap 'Reorder'. Your cart will be filled with the same items and you can review before checkout.",
      },
      {
        q: "Can I schedule an order for later?",
        a: "Yes. On the checkout page, use the 'Schedule delivery' section to pick a date and time. We support scheduling from 1 hour ahead up to 7 days out, within the restaurant's opening hours.",
      },
      {
        q: "How do I download a receipt?",
        a: "For any delivered order, open the tracking page and tap 'Download receipt' at the bottom. From the receipt page you can print or Save as PDF using your browser.",
      },
    ],
  },
  {
    id: 'payments',
    icon: 'payments',
    titleKey: 'help.category.payments',
    items: [
      {
        q: "What payment methods do you accept?",
        a: "We accept card and bank transfer via Paystack, wallet balance (top up any time), and cash on delivery for supported areas.",
      },
      {
        q: "How do I top up my wallet?",
        a: "Go to Profile → Wallet → 'Top up'. You can add funds via Paystack (card or bank). Wallet balance is credited immediately after successful payment.",
      },
      {
        q: "I was charged but the order didn't go through.",
        a: "If the payment succeeded but the order wasn't created, the amount is auto-refunded to your wallet within a few minutes. If it doesn't appear, contact support with your order number or Paystack reference.",
      },
      {
        q: "Where do refunds go?",
        a: "Refunds go to your GrandXL wallet balance so they're instantly usable on your next order. If you'd like a refund back to your bank card instead, contact support.",
      },
      {
        q: "How do I apply a coupon code?",
        a: "On the checkout page, scroll to the 'Coupon code' section, enter your code, and tap Apply. The discount will be reflected in your order total.",
      },
    ],
  },
  {
    id: 'delivery',
    icon: 'delivery',
    titleKey: 'help.category.delivery',
    items: [
      {
        q: "How is my delivery fee calculated?",
        a: "Delivery fees are set by each restaurant based on distance and zone. Some restaurants offer free delivery on your first order or during promo periods. The exact fee is shown before you place the order.",
      },
      {
        q: "My rider isn't moving on the map.",
        a: "GPS updates roughly every 15 seconds. If the map hasn't updated in over a minute, the rider might be in an area with weak signal or their phone might have paused location tracking. You can call the rider directly from the tracking page.",
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "The address can be changed only while the order is still in 'Pending' or 'Confirmed' status. Once the restaurant starts preparing, contact support to see if a change is possible.",
      },
      {
        q: "What if I'm not home when the rider arrives?",
        a: "The rider will call the phone number on your account. If you don't answer within 5 minutes and the food is perishable, the rider may return it to the restaurant. Contact support to explore options.",
      },
    ],
  },
  {
    id: 'account',
    icon: 'account',
    titleKey: 'help.category.account',
    items: [
      {
        q: "How do I change my phone number or email?",
        a: "Go to Profile → tap your name at the top to open account details. Both changes require verification via OTP before they take effect.",
      },
      {
        q: "I forgot my password.",
        a: "On the login page, tap 'Forgot password?'. We'll email you a reset link that's valid for 30 minutes.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Profile → Privacy → 'Delete my account'. This soft-deletes your account within 24 hours — order history is anonymized but retained for legal/tax purposes.",
      },
      {
        q: "Why am I not receiving notifications?",
        a: "Check your browser/device notification permissions for GrandXL. On iOS, we use web push which only works when you've added the app to your home screen and enabled notifications for the site.",
      },
    ],
  },
  {
    id: 'restaurants',
    icon: 'restaurants',
    titleKey: 'help.category.restaurants',
    items: [
      {
        q: "Why is a restaurant showing as closed?",
        a: "Restaurants set their own opening hours. Some may also temporarily close during a rush. The tracking page and restaurant page always show the current status.",
      },
      {
        q: "I got the wrong item / a missing item.",
        a: "On the delivered order page, tap 'Report a problem'. Choose 'Wrong item' or 'Missing item', add a photo if possible, and we'll refund your wallet or arrange a redelivery.",
      },
      {
        q: "How do I leave a review?",
        a: "After delivery, the tracking page shows a 'Rate this order' button. Rate the food quality, delivery, and rider — reviews help other customers and inform restaurant/rider ratings.",
      },
      {
        q: "How do I become a restaurant on GrandXL?",
        a: "Restaurants can apply at grandxl.com/restaurants/signup. Our onboarding team reviews applications and typically responds within 3 business days.",
      },
    ],
  },
]

// S14-12: contact channels. Update here if support desk changes.
export const SUPPORT_CONTACTS = {
  whatsapp: '+2348012345678',  // TODO: replace with real support WhatsApp
  email:    'support@grandxl.com',
} as const
