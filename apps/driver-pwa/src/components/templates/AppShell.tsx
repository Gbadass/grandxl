import { Outlet } from 'react-router-dom'
import { TopBar } from '../organisms/TopBar'
import { BottomNav } from '../organisms/BottomNav'
import { OfflineBanner } from '../organisms/OfflineBanner'
import { GpsBanner } from '../organisms/GpsBanner'
import { JobOfferSheet } from '../organisms/JobOfferSheet'
import { useLocationTracking } from '../../hooks/useLocationTracking'

export function AppShell() {
  useLocationTracking()
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <OfflineBanner />
      <GpsBanner />
      <TopBar />
      <main className="flex-1 pt-14 pb-16 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
      <JobOfferSheet />
    </div>
  )
}
