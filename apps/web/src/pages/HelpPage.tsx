// S14-12: Help / support center. Categorized FAQ + contact channels.
// Static content lives in features/help/faqContent.ts. Client-side search filters
// across all categories.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft, ChevronDown, Search, ShoppingBag, CreditCard,
  Bike, User, Store, MessageCircle, Mail,
} from 'lucide-react'
import { FAQ_CATEGORIES, SUPPORT_CONTACTS, type FaqCategory, type FaqItem } from '../features/help/faqContent'

const ICON_MAP = {
  orders:      ShoppingBag,
  payments:    CreditCard,
  delivery:    Bike,
  account:     User,
  restaurants: Store,
} as const

export default function HelpPage() {
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'profile'])
  const [q, setQ] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // Client-side search — matches question OR answer, case-insensitive.
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return FAQ_CATEGORIES
    return FAQ_CATEGORIES
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (it) => it.q.toLowerCase().includes(query) || it.a.toLowerCase().includes(query),
        ),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [q])

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalMatches = filtered.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-700 cursor-pointer"
            aria-label={t('common:back')}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-gray-900">Help center</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search help articles"
            className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Result count when searching */}
        {q && (
          <p className="text-xs text-gray-500 px-1">
            {totalMatches === 0
              ? `No results for "${q}"`
              : `${totalMatches} article${totalMatches === 1 ? '' : 's'} match "${q}"`}
          </p>
        )}

        {/* Categories */}
        {filtered.length === 0 && q && (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500">
            Try different keywords, or contact us directly using the buttons below.
          </div>
        )}

        {filtered.map((cat, ci) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            openIds={openIds}
            onToggle={toggle}
            index={ci}
          />
        ))}

        {/* Contact section */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mt-6">
          <h2 className="text-sm font-bold text-gray-900">Still need help?</h2>
          <p className="mt-1 text-xs text-gray-500">
            Our support team is available 8am – 10pm daily. We aim to reply within an hour.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/${SUPPORT_CONTACTS.whatsapp.replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <MessageCircle size={16} strokeWidth={2.3} />
              WhatsApp
            </a>
            <a
              href={`mailto:${SUPPORT_CONTACTS.email}?subject=Help%20request`}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <Mail size={16} strokeWidth={2.3} />
              Email
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Category card ────────────────────────────────────────────────────────────
function CategoryCard({
  category, openIds, onToggle, index,
}: {
  category: FaqCategory
  openIds: Set<string>
  onToggle: (id: string) => void
  index: number
}) {
  const Icon = ICON_MAP[category.icon]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.18 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={17} strokeWidth={2.2} className="text-primary" />
        </div>
        <h2 className="text-sm font-bold text-gray-900 capitalize">{category.id}</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {category.items.map((item, i) => {
          const id = `${category.id}-${i}`
          const isOpen = openIds.has(id)
          return <FaqRow key={id} item={item} isOpen={isOpen} onToggle={() => onToggle(id)} />
        })}
      </div>
    </motion.div>
  )
}

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-5 py-3.5 text-left cursor-pointer hover:bg-gray-50 transition-colors"
        style={{ touchAction: 'manipulation' }}
        aria-expanded={isOpen}
      >
        <span className="flex-1 text-sm font-medium text-gray-800 leading-snug">{item.q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="shrink-0 mt-0.5"
        >
          <ChevronDown size={16} className="text-gray-400" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
