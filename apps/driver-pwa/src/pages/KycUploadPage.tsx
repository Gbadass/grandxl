import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Car, Camera, CheckCircle2, Upload, AlertCircle, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadsApi, ridersApi } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { useRiderStore } from '../store/rider.store'
import { ROUTES } from '../router/routes'

interface DocSlot {
  key: 'idCard' | 'driverLicense' | 'vehiclePhoto'
  labelKey: string
  subKey: string
  Icon: React.ElementType
  accept: string
}

const DOC_SLOTS: DocSlot[] = [
  {
    key: 'idCard',
    labelKey: 'doc_id_label',
    subKey: 'doc_id_sub',
    Icon: CreditCard,
    accept: 'image/*',
  },
  {
    key: 'driverLicense',
    labelKey: 'doc_license_label',
    subKey: 'doc_license_sub',
    Icon: Car,
    accept: 'image/*',
  },
  {
    key: 'vehiclePhoto',
    labelKey: 'doc_vehicle_label',
    subKey: 'doc_vehicle_sub',
    Icon: Camera,
    accept: 'image/*',
  },
]

interface UploadState {
  url: string | null
  preview: string | null
  uploading: boolean
  error: string | null
}

const initSlot = (): UploadState => ({ url: null, preview: null, uploading: false, error: null })

export default function KycUploadPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { setRider } = useRiderStore()
  const [uploads, setUploads] = useState<Record<string, UploadState>>({
    idCard: initSlot(),
    driverLicense: initSlot(),
    vehiclePhoto: initSlot(),
  })
  const [submitting, setSubmitting] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function setSlot(key: string, patch: Partial<UploadState>) {
    setUploads((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function handleFileChange(key: string, file: File) {
    const preview = URL.createObjectURL(file)
    setSlot(key, { preview, uploading: true, error: null, url: null })
    try {
      const res = await uploadsApi.uploadRiderDocument(file)
      setSlot(key, { url: res.data.data.url, uploading: false })
    } catch (err) {
      setSlot(key, { uploading: false, error: parseApiError(err, t('upload_failed')) })
    }
  }

  const allUploaded = DOC_SLOTS.every((s) => uploads[s.key].url !== null)

  async function handleSubmit() {
    if (!allUploaded || submitting) return
    setSubmitting(true)
    try {
      const res = await ridersApi.updateDocuments({
        idCard: uploads.idCard.url!,
        driverLicense: uploads.driverLicense.url!,
        vehiclePhoto: uploads.vehiclePhoto.url!,
      })
      setRider(res.data.data)
      toast.success(t('docs_submitted'))
      void navigate(ROUTES.PENDING_VERIFICATION, { replace: true })
    } catch (err) {
      toast.error(parseApiError(err, t('docs_submit_error')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-5 pt-14 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
          <Upload size={24} className="text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-zinc-100 leading-tight">
          {t('upload_docs_title')}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {t('upload_docs_desc')}
        </p>
      </motion.div>

      {/* Progress indicator */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 flex items-center gap-2"
      >
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-1 items-center">
            <div className={`h-1.5 w-full rounded-full transition-colors duration-500 ${
              step === 1 ? 'bg-green-500' : step === 2 ? 'bg-primary' : 'bg-zinc-800'
            }`} />
          </div>
        ))}
        <p className="ml-2 text-xs font-medium text-zinc-500 shrink-0">{t('step_2_of_3')}</p>
      </motion.div>

      {/* Document upload slots */}
      <div className="flex flex-col gap-3 mb-6">
        {DOC_SLOTS.map(({ key, labelKey, subKey, Icon, accept }, i) => {
          const slot = uploads[key]
          const isDone = slot.url !== null
          const isUploading = slot.uploading

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isDone
                  ? 'border-green-500/30 bg-green-500/5'
                  : slot.error
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-zinc-800 bg-zinc-900'
              }`}
            >
              <input
                ref={(el) => { inputRefs.current[key] = el }}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileChange(key, file)
                  e.target.value = ''
                }}
              />

              {/* Card row — div, not button, to avoid nested button issue */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRefs.current[key]?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRefs.current[key]?.click() }}
                className="flex items-center gap-4 px-4 py-4 cursor-pointer"
                style={{ touchAction: 'manipulation' }}
              >
                {/* Icon / thumbnail */}
                <div className={`relative h-12 w-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden transition-colors duration-200 ${
                  isDone ? 'bg-green-500/15' : 'bg-zinc-800'
                }`}>
                  {slot.preview ? (
                    <img src={slot.preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon size={20} className={isDone ? 'text-green-400' : 'text-zinc-400'} />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                      <div className="h-5 w-5 rounded-full border-2 border-zinc-600 border-t-primary animate-spin" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold transition-colors ${
                    isDone ? 'text-green-400' : 'text-zinc-200'
                  }`}>
                    {t(labelKey)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{t(subKey)}</p>
                  {slot.error && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle size={10} />
                      {slot.error}
                    </p>
                  )}
                </div>

                {/* Status icon */}
                <div className="shrink-0">
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <CheckCircle2 size={20} className="text-green-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="upload"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <Upload size={16} className="text-zinc-600" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Preview strip — outside the clickable div to avoid nesting issues */}
              <AnimatePresence>
                {isDone && slot.preview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 140, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="relative h-[140px] w-full bg-zinc-950 flex items-center justify-center">
                      <img
                        src={slot.preview}
                        alt="Document preview"
                        className="max-h-full max-w-full object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/80 to-transparent" />
                      {/* Remove button — now NOT nested inside a button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSlot(key, initSlot())
                        }}
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-300 cursor-pointer hover:bg-zinc-800 transition-colors"
                        aria-label={t('remove_doc')}
                      >
                        <X size={13} />
                      </button>
                      <span className="absolute bottom-2 left-3 text-[10px] font-semibold text-green-300 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        {t('doc_uploaded')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Info note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38 }}
        className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-500 leading-relaxed"
      >
        {t('doc_info_note')}
      </motion.div>

      {/* Submit */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => void handleSubmit()}
        disabled={!allUploaded || submitting}
        className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
        style={{ minHeight: '56px', touchAction: 'manipulation' }}
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            {t('submitting')}
          </>
        ) : (
          <>
            {t('submit_docs')}
            <ChevronRight size={18} />
          </>
        )}
      </motion.button>

      {!allUploaded && (
        <p className="mt-3 text-center text-xs text-zinc-600">
          {t('docs_required')}
        </p>
      )}
    </div>
  )
}
