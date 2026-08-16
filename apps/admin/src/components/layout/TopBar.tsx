'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '../../store/auth.store'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi, notificationsApi, type Notification } from '@grandxl/api-client'
import { NAV_ICONS } from '../ui/Sidebar'
import type { NavItem } from './AppShell'

// ── Click-outside hook ────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

// ── Command Palette ───────────────────────────────────────────────────────────

function CommandPalette({
  navItems,
  onClose,
}: {
  navItems: NavItem[]
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = navItems.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  function navigate(href: string) {
    router.push(href)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && filtered[activeIdx]) { navigate(filtered[activeIdx].href); return }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-950/10"
        onKeyDown={handleKey}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 flex-shrink-0 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-400 hover:bg-gray-50"
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-400">No pages found</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  i === activeIdx
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={i === activeIdx ? 'text-orange-700' : 'text-gray-400'}>
                  {NAV_ICONS[item.icon]}
                </span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Notifications hook (shared between bell badge + panel) ─────────────────────

function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getMine({ limit: 20 }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Notification Panel ────────────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading } = useNotifications()
  const result = data?.data?.data
  const notifications = result?.notifications ?? []
  const unread = result?.unreadCount ?? 0

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })

  function handleClick(n: Notification) {
    if (!n.isRead) markRead.mutate(n._id)
    const orderId = (n.data as { orderId?: string } | null)?.orderId
    if (orderId) {
      router.push(`/restaurant/orders/${orderId}`)
      onClose()
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-40 mt-2 w-96 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-gray-950/[0.04]"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Notifications</p>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              {unread} new
            </span>
          )}
          {unread > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-[11px] font-semibold text-gray-500 hover:text-orange-600 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="h-8 w-8 text-gray-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <p className="text-sm font-medium text-gray-500">You&apos;re all caught up</p>
            <p className="text-xs text-gray-400">New activity will appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((n) => (
              <li
                key={n._id}
                onClick={() => handleClick(n)}
                className={`group cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50 ${n.isRead ? '' : 'bg-orange-50/50'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm ${n.isRead ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                      <p className="flex-shrink-0 text-[10px] text-gray-400">{timeAgo(n.createdAt)}</p>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-gray-500">{n.body}</p>
                  </div>
                  {!n.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── User Menu ─────────────────────────────────────────────────────────────────

function UserMenu({
  user,
  onClose,
}: {
  user: import('@grandxl/types').User | null
  onClose: () => void
}) {
  const router = useRouter()
  const { clearAuth } = useAuthStore()
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  async function handleLogout() {
    onClose()
    try { await authApi.logout() } catch { /* cookie cleared server-side */ }
    clearAuth()
    router.replace('/')
    toast.success('Signed out')
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'A'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl ring-1 ring-gray-950/[0.04]"
    >
      {/* Identity */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-1.5">
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Profile
        </button>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Preferences
        </button>
      </div>

      <div className="border-t border-gray-100 p-1.5">
        <button
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────────

interface Props {
  navItems: NavItem[]
  onMenuToggle?: () => void
}

export function TopBar({ navItems, onMenuToggle }: Props) {
  const pathname = usePathname()
  const { user } = useAuthStore()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const { data: notifData } = useNotifications()
  const unreadCount = notifData?.data?.data?.unreadCount ?? 0

  const currentNav = navItems.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + '/'),
  )

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'A'
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  // ⌘K / Ctrl+K global shortcut
  const openPalette = useCallback(() => {
    setPaletteOpen(true)
    setNotifOpen(false)
    setUserMenuOpen(false)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        openPalette()
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setNotifOpen(false)
        setUserMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openPalette])

  return (
    <>
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200/80 bg-white px-4 md:px-6">
        {/* Left — hamburger (mobile) + breadcrumb */}
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden"
              aria-label="Open sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">GrandXL</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-gray-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="font-semibold text-gray-800">{currentNav?.label ?? 'Dashboard'}</span>
        </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1">
          {/* Search / command palette */}
          <button
            onClick={openPalette}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-sans text-[10px] text-gray-400 sm:inline">⌘K</kbd>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen((o) => !o); setUserMenuOpen(false) }}
              className="relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* Divider */}
          <div className="mx-2 h-5 w-px bg-gray-200" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => { setUserMenuOpen((o) => !o); setNotifOpen(false) }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-[11px] font-bold text-white">
                {initials}
              </div>
              <span className="hidden text-sm font-medium text-gray-700 lg:inline">{fullName}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {userMenuOpen && (
              <UserMenu user={user} onClose={() => setUserMenuOpen(false)} />
            )}
          </div>
        </div>
      </header>

      {/* Command palette — rendered outside header to avoid stacking context issues */}
      {paletteOpen && (
        <CommandPalette navItems={navItems} onClose={() => setPaletteOpen(false)} />
      )}
    </>
  )
}
