import { type ReactNode } from 'react'
import { AppShell, type NavItem } from '../../src/components/layout/AppShell'
import { SocketProvider } from '../../src/components/SocketProvider'

const NAV: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: 'dashboard'   },
  { href: '/dispatch',    label: 'Live Dispatch', icon: 'dispatch'  },
  { href: '/restaurants', label: 'Restaurants', icon: 'restaurants' },
  { href: '/riders',      label: 'Riders',      icon: 'riders'      },
  { href: '/orders',      label: 'Orders',      icon: 'orders'      },
  { href: '/refunds',     label: 'Refunds',     icon: 'coupons'     },
  { href: '/disputes',    label: 'Disputes',    icon: 'disputes'    },
  { href: '/reviews',     label: 'Reviews',     icon: 'reviews'     },
  { href: '/coupons',     label: 'Coupons',     icon: 'coupons'     },
  { href: '/users',       label: 'Users',       icon: 'users'       },
  { href: '/payouts',     label: 'Payouts',     icon: 'payouts'     },
  { href: '/analytics',   label: 'Analytics',   icon: 'analytics'   },
  { href: '/settings',    label: 'Settings',    icon: 'settings'    },
]

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell navItems={NAV} portalLabel="Super Admin">
      <SocketProvider />
      {children}
    </AppShell>
  )
}
