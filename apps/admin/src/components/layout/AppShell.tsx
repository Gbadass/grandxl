'use client'

import { type ReactNode, useState, useCallback } from 'react'
import { Sidebar } from '../ui/Sidebar'
import { TopBar } from './TopBar'

export interface NavItem {
  href: string
  label: string
  icon: string
}

interface Props {
  children: ReactNode
  navItems: NavItem[]
  portalLabel: string
}

export function AppShell({ children, navItems, portalLabel }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — always visible on md+, drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar navItems={navItems} portalLabel={portalLabel} onClose={closeSidebar} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          navItems={navItems}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto bg-[#F7F8FA]">
          <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
