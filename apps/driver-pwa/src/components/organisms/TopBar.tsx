import { Bike } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRiderStore } from '../../store/rider.store'

export function TopBar() {
  const { isOnline } = useRiderStore()

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-md px-4 py-3 safe-top">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
          <Bike size={16} className="text-white" />
        </div>
        <div>
          <span className="font-display text-sm font-bold tracking-tight text-zinc-100">GrandXL</span>
          <span className="ml-1.5 text-xs text-zinc-600">Rider</span>
        </div>
      </div>

      {/* Status pill */}
      <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
        isOnline ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/20' : 'bg-zinc-800 text-zinc-500'
      }`}>
        <motion.span
          className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-zinc-600'}`}
          animate={isOnline ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {isOnline ? 'Online' : 'Offline'}
      </div>
    </header>
  )
}
