import { type ReactNode } from 'react'
import { AppShell, type NavItem } from '../../../src/components/layout/AppShell'
import { SocketProvider } from '../../../src/components/SocketProvider'

const NAV: NavItem[] = [
  { href: '/restaurant/dashboard',  label: 'Dashboard',  icon: 'dashboard'  },
  { href: '/restaurant/orders',     label: 'Orders',     icon: 'orders'     },
  { href: '/restaurant/payments',   label: 'Payments',   icon: 'payouts'    },
  { href: '/restaurant/menu',       label: 'Menu',       icon: 'menu'       },
  { href: '/restaurant/categories', label: 'Categories', icon: 'categories' },
  { href: '/restaurant/promotions', label: 'Promotions', icon: 'promotions' },
  { href: '/restaurant/reviews',    label: 'Reviews',    icon: 'reviews'    },
  { href: '/restaurant/reports',    label: 'Analytics',  icon: 'analytics'  },
  { href: '/restaurant/settings',   label: 'Settings',   icon: 'settings'   },
]

export default function RestaurantLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell navItems={NAV} portalLabel="Restaurant Portal">
      <SocketProvider />
      {children}
    </AppShell>
  )
}
