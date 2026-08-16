import { Outlet } from 'react-router-dom'
import { TopBar } from '../organisms/TopBar'
import { BottomNav } from '../organisms/BottomNav'
import { OfflineBanner } from '../organisms/OfflineBanner'

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <OfflineBanner />
      <TopBar />
      <main className="flex-1 pt-14 pb-16 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
