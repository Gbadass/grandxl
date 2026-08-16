import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import {
  ChevronRight,
  ShoppingBag,
  MapPin,
  Wallet,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Shield,
  Pencil,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '../store/auth.store'
import { useLogout } from '../features/auth/hooks/useLogout'
import { ROUTES } from '../router/routes'
import { usersApi } from '@grandxl/api-client'
import { notify } from '../utils/toast'

interface MenuItemProps {
  icon: LucideIcon
  label: string
  sublabel?: string
  onClick: () => void
  danger?: boolean
  delay?: number
}

function MenuItem({ icon: Icon, label, sublabel, onClick, danger = false, delay = 0 }: MenuItemProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.22 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-800'}`}
      style={{ touchAction: 'manipulation', minHeight: '56px' }}
    >
      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-50' : 'bg-gray-100'}`}>
        <Icon size={17} className={danger ? 'text-red-500' : 'text-gray-600'} />
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-900'}`}>{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      {!danger && <ChevronRight size={16} className="text-gray-400 shrink-0" />}
    </motion.button>
  )
}

function Divider() {
  return <div className="h-px bg-gray-100 mx-4" />
}

interface EditProfileSheetProps {
  open: boolean
  onClose: () => void
}

function EditProfileSheet({ open, onClose }: EditProfileSheetProps) {
  const { t } = useTranslation('profile')
  const { user } = useAuthStore()

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName]   = useState(user?.lastName ?? '')
  const [email, setEmail]         = useState(user?.email ?? '')

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?'

  const { mutate: saveProfile, isPending } = useMutation({
    mutationFn: () =>
      usersApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
    onSuccess: (res) => {
      const updatedUser = res.data.data
      const { accessToken } = useAuthStore.getState()
      useAuthStore.getState().setAuth(updatedUser, accessToken ?? '')
      notify.success(t('profileUpdated', 'Profile updated successfully'))
      onClose()
    },
    onError: () => {
      notify.error(t('profileUpdateFailed', 'Failed to update profile. Please try again.'))
    },
  })

  const canSave =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !isPending

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="edit-profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="edit-profile-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-8"
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-lg text-gray-900">
                {t('editProfile', 'Edit profile')}
              </h2>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center transition-colors hover:bg-gray-200"
                aria-label={t('close', 'Close')}
              >
                <X size={16} className="text-gray-600" />
              </button>
            </div>

            {/* Avatar row */}
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
                <span className="text-white font-display font-bold text-xl">{initials}</span>
              </div>
              <button
                disabled
                className="text-xs font-medium text-gray-400 cursor-not-allowed"
              >
                {t('changePhoto', 'Change photo')} — {t('comingSoon', 'Coming soon')}
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  {t('firstName', 'First name')}
                </p>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('firstNamePlaceholder', 'Enter first name')}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  {t('lastName', 'Last name')}
                </p>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('lastNamePlaceholder', 'Enter last name')}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">
                  {t('email', 'Email')}
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder', 'Enter email address')}
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition"
                />
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={() => saveProfile()}
              disabled={!canSave}
              style={{ minHeight: '56px' }}
              className="mt-6 w-full bg-primary text-white rounded-2xl font-semibold text-sm transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending
                ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                : null}
              {isPending
                ? t('saving', 'Saving…')
                : t('saveChanges', 'Save changes')}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation('profile')
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { mutate: logout, isPending: loggingOut } = useLogout()
  const [editOpen, setEditOpen] = useState(false)

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?'

  const fullName = user ? `${user.firstName} ${user.lastName}` : ''

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Edit profile sheet */}
      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/5 to-orange-50 px-5 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-4"
        >
          {/* Avatar */}
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0">
            <span className="text-white font-display font-bold text-xl">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-gray-900 truncate">{fullName}</h1>
            <p className="text-sm text-gray-500 truncate mt-0.5">{user?.phone ?? user?.email ?? ''}</p>
            {user?.email && user?.phone && (
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            )}
          </div>
          {/* Edit button */}
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1 text-primary text-sm font-medium shrink-0 transition-opacity hover:opacity-70"
            aria-label={t('editProfile', 'Edit profile')}
          >
            <Pencil size={14} />
            {t('edit', 'Edit')}
          </button>
        </motion.div>
      </div>

      {/* Menu sections */}
      <div className="mt-3 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">My account</p>
        </div>
        <Divider />
        <MenuItem
          icon={ShoppingBag}
          label="My orders"
          sublabel="Track and reorder"
          onClick={() => void navigate(ROUTES.ORDERS)}
          delay={0.05}
        />
        <Divider />
        <MenuItem
          icon={MapPin}
          label="Saved addresses"
          sublabel="Manage delivery locations"
          onClick={() => void navigate(ROUTES.ADDRESSES)}
          delay={0.1}
        />
        <Divider />
        <MenuItem
          icon={Wallet}
          label="Wallet"
          sublabel="Balance & transactions"
          onClick={() => void navigate(ROUTES.WALLET)}
          delay={0.15}
        />
        <Divider />
        <MenuItem
          icon={Bell}
          label="Notifications"
          onClick={() => void navigate(ROUTES.NOTIFICATIONS)}
          delay={0.2}
        />
      </div>

      <div className="mt-3 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Support</p>
        </div>
        <Divider />
        <MenuItem
          icon={HelpCircle}
          label="Help & Support"
          onClick={() => {}}
          delay={0.25}
        />
        <Divider />
        <MenuItem
          icon={Shield}
          label="Privacy Policy"
          onClick={() => {}}
          delay={0.28}
        />
        <Divider />
        <MenuItem
          icon={User}
          label="Terms of Service"
          onClick={() => {}}
          delay={0.31}
        />
      </div>

      <div className="mt-3 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.22 }}
          onClick={() => logout()}
          disabled={loggingOut}
          className="w-full flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-colors hover:bg-red-50 disabled:opacity-60"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="h-9 w-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            {loggingOut
              ? <span className="h-4 w-4 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
              : <LogOut size={17} className="text-red-500" />
            }
          </div>
          <span className="text-sm font-medium text-red-500">
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </span>
        </motion.button>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 text-center text-xs text-gray-400"
      >
        GrandXL v1.0 · Made with love for Nigeria
      </motion.p>
    </div>
  )
}
