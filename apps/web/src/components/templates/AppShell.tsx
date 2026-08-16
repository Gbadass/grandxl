import { Outlet } from 'react-router-dom'
import { NavBar } from '../organisms/NavBar'
import { BottomNav } from '../organisms/BottomNav'
import { CartFab } from '../organisms/CartFab'
import { useDetectLocation } from '../../hooks/useDetectLocation'

export function AppShell() {
  useDetectLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      {/* pt-0 on mobile (no top nav), pt-16 on desktop (top nav h-16) */}
      {/* pb-20 on mobile (bottom nav h-16 + 1rem gap), pb-0 on desktop */}
      <main className="pt-0 md:pt-16 pb-20 md:pb-0">
        <Outlet />
      </main>
      <CartFab />
      <BottomNav />
    </div>
  )
}
