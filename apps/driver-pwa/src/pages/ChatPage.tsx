import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronDown, Send } from 'lucide-react'
import { chatApi, ordersApi } from '@grandxl/api-client'
import type { ChatMessage } from '@grandxl/api-client'
import { socket } from '../lib/socket'
import { useAuthStore } from '../store/auth.store'
import { ROUTES } from '../router/routes'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string, t: (key: string) => string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return t('chat_today')
  if (d.toDateString() === yesterday.toDateString()) return t('chat_yesterday')
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}


// ── Read ticks ─────────────────────────────────────────────────────────────────

function Ticks({ isRead }: { isRead: boolean }) {
  return (
    <svg width="15" height="10" viewBox="0 0 16 10" className={`inline-block ml-0.5 shrink-0 ${isRead ? 'text-primary' : 'text-zinc-400'}`} fill="none">
      <path d="M1 5l3 3 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5l3 3 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  const { t } = useTranslation('rider')
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex items-end gap-2 px-4"
    >
      <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0">C</div>
      <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 border border-zinc-700/50">
        {[0, 0.18, 0.36].map((delay, i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-zinc-500"
            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.7, repeat: Infinity, delay, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <span className="text-xs text-zinc-600 pb-1">{t('chat_customer_typing')}</span>
    </motion.div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  showAvatar,
  showTime,
  onRetry,
}: {
  msg: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  showTime: boolean
  onRetry?: (msg: ChatMessage) => void
}) {
  const { t } = useTranslation('rider')
  const isFailed = msg.status === 'failed'
  const isSending = msg.status === 'sending'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: isSending ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className={`flex items-end gap-2 px-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {!isOwn ? (
        <div className={`h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-300 shrink-0 transition-opacity ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
          C
        </div>
      ) : null}

      <div className={`flex flex-col gap-0.5 max-w-[78%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 text-[14px] leading-relaxed break-words ${
            isOwn
              ? isFailed
                ? 'bg-red-900/40 text-red-300 rounded-2xl rounded-br-[4px] border border-red-500/30'
                : 'bg-primary text-white rounded-2xl rounded-br-[4px] shadow-md shadow-primary/20'
              : 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-bl-[4px] border border-zinc-700/50'
          }`}
        >
          {msg.deletedAt ? (
            <span className="italic opacity-40 text-sm">{t('chat_message_removed')}</span>
          ) : (
            msg.text
          )}
        </div>

        {showTime && (
          <div className={`flex items-center gap-1 text-[10px] text-zinc-600 mt-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
            <span>{formatTime(msg.createdAt)}</span>
            {isOwn && <Ticks isRead={!!msg.readAt} />}
          </div>
        )}

        {isFailed && onRetry && (
          <button
            onClick={() => onRetry(msg)}
            className="text-[11px] text-red-400 font-semibold mt-0.5 cursor-pointer hover:underline"
          >
            {t('chat_failed_retry')}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main ChatPage ──────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('rider')
  const { user } = useAuthStore()

  const QUICK_REPLIES = [
    t('chat_quick_reply1'),
    t('chat_quick_reply2'),
    t('chat_quick_reply3'),
    t('chat_quick_reply4'),
    t('chat_quick_reply5'),
    t('chat_quick_reply6'),
  ]

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [showQuickReplies, setShowQuickReplies] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAtBottom = useRef(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Order for header context
  const { data: orderResp } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getById(orderId!),
    enabled: !!orderId,
  })
  const order = orderResp?.data?.data

  // Fetch history
  const { isLoading: historyLoading } = useQuery({
    queryKey: ['chat-history-rider', orderId],
    queryFn: async () => {
      const res = await chatApi.getMessages(orderId!, { limit: 50 })
      const data = res.data.data
      setMessages(data.messages)
      setHasMore(data.total > data.messages.length)
      return data
    },
    enabled: !!orderId,
  })

  // Socket
  const joinRoom = useCallback(() => {
    if (orderId) socket.emit('order:join_room', { orderId })
  }, [orderId])

  useEffect(() => {
    joinRoom()
    socket.on('connect', joinRoom)

    function onMessage(msg: ChatMessage) {
      setMessages((prev) => {
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m._id === msg.tempId)
          if (idx !== -1) {
            const next = [...prev]
            next[idx] = { ...msg, status: 'sent' }
            return next
          }
        }
        if (prev.some((m) => m._id === msg._id)) return prev
        if (!isAtBottom.current) {
          setNewMsgCount((c) => c + 1)
          setShowScrollBtn(true)
        }
        return [...prev, { ...msg, status: 'sent' }]
      })
    }

    function onPeerTyping(data: { orderId: string; isTyping: boolean }) {
      if (data.orderId === orderId) setPeerTyping(data.isTyping)
    }

    function onMessagesRead(data: { orderId: string; readAt: string }) {
      if (data.orderId !== orderId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === user?._id && !m.readAt
            ? { ...m, isRead: true, readAt: data.readAt }
            : m,
        ),
      )
    }

    socket.on('chat:message', onMessage)
    socket.on('chat:peer_typing', onPeerTyping)
    socket.on('chat:messages_read', onMessagesRead)

    return () => {
      socket.off('connect', joinRoom)
      socket.off('chat:message', onMessage)
      socket.off('chat:peer_typing', onPeerTyping)
      socket.off('chat:messages_read', onMessagesRead)
      socket.emit('order:leave_room', { orderId: orderId! })
    }
  }, [orderId, joinRoom, user?._id])

  // Mark read on open
  useEffect(() => {
    if (orderId) {
      socket.emit('chat:read', { orderId })
      chatApi.markRead(orderId).catch(() => undefined)
    }
  }, [orderId])

  // Auto-scroll
  useEffect(() => {
    if (isAtBottom.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, peerTyping])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBtn(false)
    setNewMsgCount(0)
    isAtBottom.current = true
  }

  function handleScroll() {
    const el = scrollAreaRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    isAtBottom.current = atBottom
    if (atBottom) {
      setShowScrollBtn(false)
      setNewMsgCount(0)
    }
  }

  async function loadEarlier() {
    if (!orderId || loadingMore || !hasMore) return
    setLoadingMore(true)
    const oldest = messages[0]
    const res = await chatApi.getMessages(orderId, { before: oldest?.createdAt, limit: 30 })
    const older = res.data.data.messages
    setMessages((prev) => [...older, ...prev])
    setHasMore(older.length === 30)
    setLoadingMore(false)
    const el = scrollAreaRef.current
    if (el) {
      const prevH = el.scrollHeight
      requestAnimationFrame(() => { el.scrollTop += el.scrollHeight - prevH })
    }
  }

  function handleInput(value: string) {
    setText(value)
    if (!orderId) return
    if (!isTyping) {
      setIsTyping(true)
      socket.emit('chat:typing', { orderId, isTyping: true })
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false)
      socket.emit('chat:typing', { orderId, isTyping: false })
    }, 2000)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }

  function send(overrideText?: string) {
    const trimmed = (overrideText ?? text).trim()
    if (!trimmed || !orderId || !user) return
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    if (isTyping) {
      socket.emit('chat:typing', { orderId, isTyping: false })
      setIsTyping(false)
    }
    const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const optimistic: ChatMessage = {
      _id: tempId, orderId, senderId: user._id,
      senderRole: 'rider', text: trimmed,
      isRead: false, readAt: null, deletedAt: null,
      createdAt: new Date().toISOString(), status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setText('')
    setShowQuickReplies(false)
    isAtBottom.current = true
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    socket.emit('chat:send', { orderId, text: trimmed, tempId }, (ack: { ok: boolean } | undefined) => {
      if (!ack?.ok) {
        setMessages((prev) => prev.map((m) => m._id === tempId ? { ...m, status: 'failed' } : m))
      }
    })
  }

  function retryMessage(msg: ChatMessage) {
    setMessages((prev) => prev.filter((m) => m._id !== msg._id))
    setText(msg.text)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-950">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20">
        <button
          onClick={() => navigate(order ? ROUTES.ACTIVE_DELIVERY.replace(':orderId', order._id) : ROUTES.HOME)}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          aria-label={t('chat_back')}
        >
          <ChevronLeft size={22} className="text-zinc-300" />
        </button>

        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-sm select-none">
            C
          </div>
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-zinc-900" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-100 leading-tight">{t('chat_customer')}</p>
          {order && (
            <p className="text-[11px] text-zinc-500 truncate">
              {order.orderNumber} · {order.deliveryAddress.street}
            </p>
          )}
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────── */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4 flex flex-col gap-1"
      >
        {hasMore && (
          <div className="flex justify-center mb-2">
            <button
              onClick={loadEarlier}
              disabled={loadingMore}
              className="text-xs text-zinc-400 font-semibold px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? t('chat_loading_earlier') : t('chat_load_earlier')}
            </button>
          </div>
        )}

        {historyLoading && (
          <div className="flex flex-col gap-3 px-4 animate-pulse">
            {[0.5, 0.7, 0.4, 0.65].map((w, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className="h-9 rounded-2xl bg-zinc-800" style={{ width: `${w * 220}px` }} />
              </div>
            ))}
          </div>
        )}

        {!historyLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-4 mt-20">
            <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-300">{t('chat_empty_title')}</p>
              <p className="text-xs text-zinc-600 mt-1">{t('chat_reach_out')}</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_REPLIES.slice(0, 3).map((r) => (
                <button key={r} onClick={() => send(r)}
                  className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5 cursor-pointer hover:bg-primary/20 transition-colors">
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const prev = messages[idx - 1]
          const next = messages[idx + 1]
          const showDayLabel = !prev || !isSameDay(prev.createdAt, msg.createdAt)
          const isOwn = msg.senderId === user?._id
          const showTime = !next || next.senderId !== msg.senderId ||
            !isSameDay(msg.createdAt, next.createdAt) ||
            new Date(next.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000
          const showAvatar = !isOwn && (!next || next.senderId !== msg.senderId)

          return (
            <div key={msg._id}>
              {showDayLabel && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] text-zinc-500 bg-zinc-800 rounded-full px-3 py-1 border border-zinc-700">
                    {formatDateLabel(msg.createdAt, t)}
                  </span>
                </div>
              )}
              <MessageBubble
                msg={msg} isOwn={isOwn} showAvatar={showAvatar}
                showTime={showTime}
                onRetry={msg.status === 'failed' ? retryMessage : undefined}
              />
            </div>
          )
        })}

        <AnimatePresence>
          {peerTyping && (
            <div className="pt-1">
              <TypingIndicator />
            </div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Scroll to bottom button ───────────────────────────────── */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            key="scroll-btn"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 right-4 z-30 h-10 w-10 rounded-full bg-zinc-800 border border-zinc-700 shadow-lg flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors"
          >
            {newMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
                {newMsgCount}
              </span>
            )}
            <ChevronDown size={18} className="text-zinc-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Quick replies ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showQuickReplies && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-zinc-900 border-t border-zinc-800"
          >
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
              {QUICK_REPLIES.map((r) => (
                <button key={r} onClick={() => send(r)}
                  className="shrink-0 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-3.5 py-1.5 cursor-pointer hover:bg-primary/20 transition-colors whitespace-nowrap">
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input bar ─────────────────────────────────────────────── */}
      <div className="px-3 py-3 bg-zinc-900 border-t border-zinc-800 flex items-end gap-2 safe-area-bottom">
        <button
          onClick={() => setShowQuickReplies((v) => !v)}
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${showQuickReplies ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          aria-label={t('chat_quick_replies')}
          style={{ touchAction: 'manipulation' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder={t('chat_placeholder')}
            maxLength={500}
            rows={1}
            className="w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          {text.length > 420 && (
            <span className={`absolute bottom-1.5 right-3 text-[10px] font-mono ${text.length >= 490 ? 'text-red-400' : 'text-zinc-600'}`}>
              {500 - text.length}
            </span>
          )}
        </div>

        <motion.button
          type="button"
          onClick={() => send()}
          disabled={!text.trim()}
          whileTap={{ scale: 0.88 }}
          transition={{ duration: 0.08 }}
          className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 disabled:opacity-35 transition-opacity cursor-pointer shadow-md shadow-primary/25"
          aria-label={t('chat_send')}
          style={{ touchAction: 'manipulation' }}
        >
          <Send size={17} className="translate-x-[1px]" />
        </motion.button>
      </div>
    </div>
  )
}
