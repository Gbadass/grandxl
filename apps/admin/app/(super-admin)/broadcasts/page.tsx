'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Users, Send, Loader2, AlertTriangle, Link as LinkIcon } from 'lucide-react'
import { adminBroadcastsApi, type BroadcastHistoryRow } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import '../../../src/lib/axios'

const AUDIENCE_OPTIONS: { role: UserRole; label: string; hint: string }[] = [
  { role: UserRole.CUSTOMER,         label: 'Customers',         hint: 'Everyone who ordered from GrandXL' },
  { role: UserRole.RIDER,            label: 'Riders',            hint: 'All registered riders' },
  { role: UserRole.RESTAURANT_OWNER, label: 'Restaurant owners', hint: 'One account per restaurant' },
]

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function actorName(actor: BroadcastHistoryRow['actorId']): string {
  if (typeof actor === 'string') return actor.slice(-6)
  return `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim() || '—'
}

export default function BroadcastsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, isInitializing, user, router])

  const [audiences, setAudiences] = useState<UserRole[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [actionUrl, setActionUrl] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: historyRes, isLoading: histLoading } = useQuery({
    queryKey: ['admin', 'broadcasts', 1],
    queryFn:  () => adminBroadcastsApi.list({ page: 1, limit: 20 }).then((r) => r.data.data),
    enabled:  isAuthenticated,
  })
  const history: BroadcastHistoryRow[] = historyRes?.items ?? []

  const sendMutation = useMutation({
    mutationFn: () => adminBroadcastsApi.send({
      audiences,
      title:  title.trim(),
      body:   body.trim(),
      actionUrl: actionUrl.trim() || undefined,
    }),
    onSuccess: (res) => {
      const { recipientCount, deliveredCount } = res.data.data
      toast.success(`Broadcast sent — delivered to ${deliveredCount} of ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`)
      setAudiences([])
      setTitle('')
      setBody('')
      setActionUrl('')
      setConfirmOpen(false)
      void qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] })
    },
    onError: (e: unknown) => {
      toast.error(parseApiError(e, 'Broadcast failed'))
      setConfirmOpen(false)
    },
  })

  const validUrl = !actionUrl.trim() || /^https?:\/\//.test(actionUrl.trim())
  const canSend =
    audiences.length > 0 &&
    title.trim().length >= 3 &&
    body.trim().length >= 3 &&
    validUrl &&
    !sendMutation.isPending

  function toggleAudience(r: UserRole) {
    setAudiences((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])
  }

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcasts"
        subtitle="Send system-wide announcements to customers, riders, and restaurant owners"
      />

      {/* ── Composer ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-orange-50 p-2.5 text-orange-600">
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">New broadcast</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Every recipient gets an in-app notification, socket update, and push (Expo + web).
              Audience is deduped across roles (a customer who is also a rider gets one notification).
            </p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500">Audience</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {AUDIENCE_OPTIONS.map(({ role, label, hint }) => {
              const on = audiences.includes(role)
              return (
                <button
                  key={role}
                  onClick={() => toggleAudience(role)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    on ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100' : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className={`shrink-0 rounded-full p-1.5 ${on ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    <Users size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
            Title <span className="ml-1 font-normal normal-case tracking-normal text-gray-400">({title.length}/120)</span>
          </label>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Maintenance window Saturday 2-4 am"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
            Body <span className="ml-1 font-normal normal-case tracking-normal text-gray-400">({body.length}/1000)</span>
          </label>
          <textarea
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Keep it short — push notification body shows the first ~120 chars on iOS. Link out for detail."
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
            <LinkIcon size={11} /> Action URL <span className="ml-1 font-normal normal-case tracking-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
            placeholder="https://grandxl.com/status"
            className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-orange-100 ${
              validUrl ? 'border-gray-200 focus:border-orange-400' : 'border-red-300 focus:border-red-400'
            }`}
          />
          {!validUrl && <p className="mt-1 text-xs text-red-600">URL must start with http:// or https://</p>}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            {audiences.length === 0 ? 'Pick at least one audience.' : `Will send to: ${audiences.map((r) => r.replace('_', ' ')).join(', ')}`}
          </p>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={14} />
            Send broadcast
          </button>
        </div>
      </div>

      {/* ── History ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-gray-800">Recent broadcasts</h3>
        </div>
        {histLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No broadcasts sent yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((b) => (
              <div key={b._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{b.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {b.audiences.map((a) => (
                        <span key={a} className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 capitalize">
                          {a.replace('_', ' ')}
                        </span>
                      ))}
                      {b.actionUrl && (
                        <a
                          href={b.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-orange-600 truncate max-w-[220px]"
                        >
                          <LinkIcon size={10} /> {b.actionUrl}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-gray-800 tabular-nums">
                      {b.deliveredCount}/{b.recipientCount}
                    </p>
                    <p className="text-[10px] text-gray-400">delivered</p>
                    <p className="mt-1 text-[10px] text-gray-500 whitespace-nowrap">{fmtDate(b.sentAt)}</p>
                    <p className="text-[10px] text-gray-400">by {actorName(b.actorId)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Confirm modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !sendMutation.isPending && setConfirmOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{    opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-5">
                <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Send broadcast now?</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Every recipient will get an in-app notification and a push. There&apos;s no undo.
                  </p>
                </div>
              </div>
              <div className="px-6 py-5 space-y-2 text-sm">
                <p><span className="font-semibold text-gray-800">Audience:</span> {audiences.map((r) => r.replace('_', ' ')).join(', ')}</p>
                <p><span className="font-semibold text-gray-800">Title:</span> {title}</p>
                <p className="text-gray-600 line-clamp-3"><span className="font-semibold text-gray-800">Body:</span> {body}</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={sendMutation.isPending}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {sendMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Send broadcast
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
