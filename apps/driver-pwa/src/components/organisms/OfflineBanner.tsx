import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff, Wifi } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useUiStore } from '../../store/ui.store'

export function OfflineBanner() {
  const { t } = useTranslation()
  const { isOnline, setNetworkOnline } = useUiStore()

  useEffect(() => {
    function handleOnline() {
      setNetworkOnline(true)
      toast.success(t('online_restored'), { icon: <Wifi size={16} /> })
    }
    function handleOffline() {
      setNetworkOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setNetworkOnline, t])

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-zinc-800 px-4 py-2 text-sm text-zinc-200"
        >
          <WifiOff size={14} />
          <span>{t('offline')}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
