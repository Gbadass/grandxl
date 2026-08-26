import { AnimatePresence, motion } from 'framer-motion'
import { MapPinOff } from 'lucide-react'
import { useRiderStore } from '../../store/rider.store'

// Persistent warning banner when GPS isn't transmitting. Riders who don't know
// dispatch can't see them will sit and wonder why no jobs come — this makes the
// invisible failure very visible.
export function GpsBanner() {
  const isOnline = useRiderStore((s) => s.isOnline)
  const gpsStatus = useRiderStore((s) => s.gpsStatus)

  // Only shown when rider has flipped online — dispatch doesn't care about GPS otherwise.
  const shouldShow = isOnline && gpsStatus !== 'ok' && gpsStatus !== 'unknown'
  if (!shouldShow) return null

  const message =
    gpsStatus === 'permission_denied'
      ? 'GPS blocked — allow Location and reload. Dispatch cannot see you.'
      : gpsStatus === 'unavailable'
        ? 'No GPS signal. Move to open sky.'
        : gpsStatus === 'timeout'
          ? 'GPS is slow. Check your signal.'
          : 'GPS problem — dispatch cannot see you.'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed left-0 right-0 top-0 z-40 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        <MapPinOff size={16} />
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  )
}
