import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, MapPin, Home, Briefcase, Star, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Address } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '../features/addresses/hooks/useAddresses'
import { AddressPickerSheet } from '../features/addresses/components/AddressPickerSheet'

const LABEL_ICONS: Record<string, React.ReactNode> = {
  home:   <Home size={16} />,
  work:   <Briefcase size={16} />,
  office: <Briefcase size={16} />,
  other:  <MapPin size={16} />,
}

function labelIcon(label: string) {
  return LABEL_ICONS[label.toLowerCase()] ?? <MapPin size={16} />
}

function AddressRow({
  address,
  isDefault,
  onDelete,
  onSetDefault,
  delay,
}: {
  address: Address
  isDefault: boolean
  onDelete: () => void
  onSetDefault: () => void
  delay: number
}) {
  const { t } = useTranslation(['addresses', 'common'])
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ delay, duration: 0.2 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isDefault ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
          {labelIcon(address.label)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 capitalize">{address.label}</p>
            {isDefault && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {t('default')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{address.street}</p>
          <p className="text-xs text-gray-400">{address.city}, {address.state}</p>
          {address.instructions && (
            <p className="text-xs text-gray-400 mt-0.5 italic">{address.instructions}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-50 flex divide-x divide-gray-50">
        {!isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-500 hover:text-primary hover:bg-primary/5 cursor-pointer transition-colors"
          >
            <Star size={13} />
            {t('setDefault')}
          </button>
        )}
        <AnimatePresence mode="wait">
          {confirmDelete ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex divide-x divide-gray-50"
            >
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 text-xs font-medium text-gray-400 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 py-3 text-xs font-semibold text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
              >
                {t('common:delete')}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="delete-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors ${!isDefault ? 'w-16 shrink-0' : 'flex-1'}`}
            >
              <Trash2 size={13} />
              {isDefault && 'Delete'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function AddressesPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('addresses')
  const { addresses, defaultAddressId } = useAddresses()
  const { mutate: deleteAddress } = useDeleteAddress()
  const { mutate: setDefault } = useSetDefaultAddress()
  const [addSheetOpen, setAddSheetOpen] = useState(false)

  function handleDelete(id: string) {
    deleteAddress(id)
    toast.success(t('removed'))
  }

  function handleSetDefault(id: string) {
    setDefault(id, {
      onSuccess: () => toast.success(t('defaultUpdated')),
      onError: (err: unknown) => toast.error(parseApiError(err, t('defaultUpdateError'))),
    })
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => void navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors"
            aria-label={t('common:back')}
          >
            <ChevronLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="font-display font-bold text-xl text-gray-900">{t('title')}</h1>
        </div>

        {/* Address list */}
        {addresses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
              <MapPin size={36} className="text-gray-300" />
            </div>
            <h2 className="font-semibold text-gray-900">{t('empty')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('emptySub')}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {addresses.map((addr, i) => (
                <AddressRow
                  key={addr._id}
                  address={addr}
                  isDefault={addr._id === defaultAddressId}
                  onDelete={() => handleDelete(addr._id)}
                  onSetDefault={() => handleSetDefault(addr._id)}
                  delay={i * 0.05}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add address CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: addresses.length * 0.05 + 0.1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setAddSheetOpen(true)}
          className="mt-4 w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Plus size={18} />
          </div>
          <span className="font-medium text-sm">{t('add')}</span>
        </motion.button>
      </div>

      <AddressPickerSheet
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        selected={null}
        onSelect={() => setAddSheetOpen(false)}
      />
    </>
  )
}
