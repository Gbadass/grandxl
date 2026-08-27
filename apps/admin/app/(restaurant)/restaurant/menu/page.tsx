'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Plus, Pencil, Trash2, UtensilsCrossed, Clock,
  X, Package, CheckCircle2, XCircle, Check,
  Tag, Coins, Eye, EyeOff, Loader2,
} from 'lucide-react'
import { myRestaurantApi, menuApi, menuManagementApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { MenuCategory, MenuItem } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

// ── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  categoryName,
  onEdit,
  onDelete,
  onToggle,
  toggling,
  selected,
  onToggleSelect,
}: {
  item: MenuItem
  categoryName: string | undefined
  onEdit: () => void
  onDelete: () => void
  onToggle: (available: boolean) => void
  toggling: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        selected ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-100'
      } ${!item.isAvailable ? 'opacity-75' : ''}`}
    >
      {/* Selection checkbox — always visible top-left */}
      <button
        onClick={onToggleSelect}
        aria-pressed={selected}
        aria-label={selected ? 'Deselect item' : 'Select item'}
        className={`absolute top-2 left-2 z-10 h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow ${
          selected
            ? 'bg-orange-600 text-white'
            : 'bg-white/90 text-gray-400 hover:text-orange-600 hover:bg-white'
        }`}
      >
        {selected ? <Check size={14} strokeWidth={3} /> : <span className="h-3 w-3 rounded-full border-2 border-current" />}
      </button>

      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden shrink-0">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
            <UtensilsCrossed size={36} className="text-orange-200" />
          </div>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 bg-black/20 flex items-start justify-end p-2">
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
              Sold Out
            </span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={onEdit}
              className="h-8 w-8 rounded-full bg-white/95 shadow-md flex items-center justify-center text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
              aria-label="Edit item"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="h-8 w-8 rounded-full bg-white/95 shadow-md flex items-center justify-center text-gray-700 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
              aria-label="Delete item"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 flex-1">{item.name}</p>
          <p className="font-bold text-orange-600 text-sm whitespace-nowrap">{formatMoney(item.basePrice, 'NGN')}</p>
        </div>
        {item.description && (
          <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {categoryName && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {categoryName}
            </span>
          )}
          {item.prepTimeMinutes != null && (
            <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              <Clock size={9} />
              {item.prepTimeMinutes}m
            </span>
          )}
        </div>
      </div>

      {/* Toggle footer */}
      <div className="px-3 pb-3 pt-1">
        <button
          onClick={() => !toggling && onToggle(!item.isAvailable)}
          disabled={toggling}
          className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-colors cursor-pointer min-h-[40px] ${
            item.isAvailable
              ? 'bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600'
              : 'bg-red-50 text-red-600 hover:bg-green-50 hover:text-green-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {toggling ? 'Updating…' : item.isAvailable ? '● Available — tap to mark sold out' : '○ Sold out — tap to mark available'}
        </button>
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-gray-100" />
          <div className="p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <div className="h-4 bg-gray-100 rounded flex-1" />
              <div className="h-4 w-16 bg-gray-100 rounded" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-9 bg-gray-100 rounded-xl mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
        <UtensilsCrossed size={28} className="text-orange-300" />
      </div>
      <p className="font-semibold text-gray-700 text-base">
        {hasSearch ? 'No items match your search' : 'No items here yet'}
      </p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        {hasSearch
          ? 'Try a different search term or clear the filter.'
          : 'Add your first menu item to get started.'}
      </p>
      {!hasSearch && (
        <button
          onClick={onAdd}
          className="mt-5 flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors cursor-pointer"
        >
          <Plus size={15} />
          Add item
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RestaurantMenuPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; name: string } | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ type: 'category' | 'item'; id: string } | null>(null)
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)

  // Sprint 12 (S12-7): bulk edit selection state. Kept as a Set for O(1) hit-tests
  // when rendering ~100+ item cards. Selection persists across category filter
  // changes (so you can multi-select from different categories in one pass).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<'category' | 'price' | 'delete' | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER))
      router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data: restaurantsData } = useQuery({
    queryKey: ['my-restaurants'],
    queryFn: () => myRestaurantApi.list(),
    enabled: isAuthenticated,
  })
  const restaurantId = restaurantsData?.data?.data?.[0]?._id

  const { data: categoriesData, isLoading: loadingCats } = useQuery({
    queryKey: ['menu-categories', restaurantId],
    queryFn: () => menuApi.getCategories(restaurantId!),
    enabled: !!restaurantId,
  })
  const categories = (categoriesData?.data?.data ?? []) as MenuCategory[]

  const { data: itemsData, isLoading: loadingItems } = useQuery({
    queryKey: ['menu-items', restaurantId],
    queryFn: () => menuApi.getItems(restaurantId!),
    enabled: !!restaurantId,
  })
  const allItems = (itemsData?.data?.data?.items ?? []) as MenuItem[]

  // ── Computed ───────────────────────────────────────────────────────────────

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c._id, c.name])),
    [categories],
  )

  const categoryItemCount = useMemo(() => {
    const m = new Map<string, number>()
    allItems.forEach((i) => m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1))
    return m
  }, [allItems])

  const filteredItems = useMemo(() => {
    let r = selectedCategory ? allItems.filter((i) => i.categoryId === selectedCategory) : allItems
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      r = r.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q),
      )
    }
    return r
  }, [allItems, selectedCategory, searchQuery])

  const totalItems = allItems.length
  const availableItems = allItems.filter((i) => i.isAvailable).length
  const outOfStock = totalItems - availableItems

  // ── Mutations ──────────────────────────────────────────────────────────────

  const addCategoryMutation = useMutation({
    mutationFn: () =>
      menuManagementApi.createCategory(restaurantId!, { name: newCategoryName.trim() }),
    onSuccess: () => {
      toast.success('Category added')
      void qc.invalidateQueries({ queryKey: ['menu-categories', restaurantId] })
      setShowAddCategory(false)
      setNewCategoryName('')
    },
    onError: () => toast.error('Failed to add category'),
  })

  const renameMutation = useMutation({
    mutationFn: ({ catId, name }: { catId: string; name: string }) =>
      menuManagementApi.updateCategory(restaurantId!, catId, { name: name.trim() }),
    onSuccess: () => {
      toast.success('Category renamed')
      void qc.invalidateQueries({ queryKey: ['menu-categories', restaurantId] })
      setRenamingCategory(null)
    },
    onError: () => toast.error('Rename failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteItem || !restaurantId) throw new Error()
      if (deleteItem.type === 'category')
        return menuManagementApi.deleteCategory(restaurantId, deleteItem.id)
      return menuManagementApi.deleteItem(restaurantId, deleteItem.id)
    },
    onSuccess: () => {
      toast.success('Deleted')
      void qc.invalidateQueries({ queryKey: ['menu-categories', restaurantId] })
      void qc.invalidateQueries({ queryKey: ['menu-items', restaurantId] })
      setDeleteItem(null)
    },
    onError: () => toast.error('Delete failed'),
  })

  const toggleAvailability = useMutation({
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      setTogglingItemId(itemId)
      return menuManagementApi.updateItem(restaurantId!, itemId, { isAvailable })
    },
    onSettled: () => setTogglingItemId(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['menu-items', restaurantId] }),
    onError: () => toast.error('Failed to update availability'),
  })

  // ── Sprint 12 (S12-7): bulk mutations ──────────────────────────────────────
  //
  // All four share the same invalidate + selection clear on success. Errors
  // surface the server message when available (e.g., "Only 3 of 5 items belong
  // to this restaurant") so operators know exactly which action to take.

  function invalidateItems() { void qc.invalidateQueries({ queryKey: ['menu-items', restaurantId] }) }

  function serverMsg(e: unknown, fallback: string): string {
    const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
    return fallback
  }

  const bulkAvailabilityMutation = useMutation({
    mutationFn: ({ isAvailable }: { isAvailable: boolean }) =>
      menuManagementApi.bulkSetAvailability(restaurantId!, Array.from(selectedIds), isAvailable),
    onSuccess: (res, vars) => {
      const n = res.data.data.modifiedCount
      toast.success(`${n} item${n === 1 ? '' : 's'} marked ${vars.isAvailable ? 'available' : 'sold out'}`)
      setSelectedIds(new Set())
      invalidateItems()
    },
    onError: (e) => toast.error(serverMsg(e, 'Bulk update failed')),
  })

  const bulkCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      menuManagementApi.bulkMoveCategory(restaurantId!, Array.from(selectedIds), categoryId),
    onSuccess: (res) => {
      const n = res.data.data.modifiedCount
      toast.success(`${n} item${n === 1 ? '' : 's'} moved`)
      setSelectedIds(new Set())
      setBulkAction(null)
      invalidateItems()
    },
    onError: (e) => toast.error(serverMsg(e, 'Bulk move failed')),
  })

  const bulkPriceMutation = useMutation({
    mutationFn: (args: { mode: 'percent' | 'fixed' | 'set'; value: number }) =>
      menuManagementApi.bulkAdjustPrice(restaurantId!, Array.from(selectedIds), args.mode, args.value),
    onSuccess: (res) => {
      const n = res.data.data.modifiedCount
      toast.success(`Prices updated on ${n} item${n === 1 ? '' : 's'}`)
      setSelectedIds(new Set())
      setBulkAction(null)
      invalidateItems()
    },
    onError: (e) => toast.error(serverMsg(e, 'Bulk price update failed')),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      menuManagementApi.bulkDelete(restaurantId!, Array.from(selectedIds)),
    onSuccess: (res) => {
      const n = res.data.data.deletedCount
      toast.success(`${n} item${n === 1 ? '' : 's'} deleted`)
      setSelectedIds(new Set())
      setBulkAction(null)
      invalidateItems()
    },
    onError: (e) => toast.error(serverMsg(e, 'Bulk delete failed')),
  })

  function toggleSelection(itemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  // "Select all in view" toggles between selecting every filtered item and
  // clearing them. Selection outside the current filter is preserved so users
  // can select across multiple filters without losing prior picks.
  function toggleSelectAllInView() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const filteredIds = filteredItems.map((i) => i._id)
      const allSelected = filteredIds.every((id) => next.has(id))
      if (allSelected) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  }

  if (isInitializing) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your categories and items</p>
        </div>
        <button
          onClick={() => router.push('/restaurant/menu/items/new')}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 transition-colors cursor-pointer min-h-[44px]"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={15} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
          <p className="text-xs text-gray-400 mt-0.5">items</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-green-500" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Available</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{availableItems}</p>
          <p className="text-xs text-gray-400 mt-0.5">on sale</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={15} className="text-red-400" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Sold Out</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{outOfStock}</p>
          <p className="text-xs text-gray-400 mt-0.5">unavailable</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items by name or description…"
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* All items pill */}
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === null
                ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            All items ({totalItems})
          </button>

          {!loadingCats &&
            categories.map((cat) => (
              <div key={cat._id} className="group shrink-0 relative flex items-center">
                {renamingCategory?.id === cat._id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      if (renamingCategory.name.trim())
                        renameMutation.mutate({ catId: cat._id, name: renamingCategory.name })
                    }}
                  >
                    <input
                      autoFocus
                      value={renamingCategory.name}
                      onChange={(e) =>
                        setRenamingCategory((r) => (r ? { ...r, name: e.target.value } : r))
                      }
                      onBlur={() => setRenamingCategory(null)}
                      onKeyDown={(e) => e.key === 'Escape' && setRenamingCategory(null)}
                      className="rounded-full border border-orange-400 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 outline-none w-36"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => setSelectedCategory(cat._id)}
                    className={`rounded-full px-3.5 py-1.5 pr-9 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat._id
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-200'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    {cat.name} ({categoryItemCount.get(cat._id) ?? 0})
                  </button>
                )}
                {/* Actions (visible on hover) */}
                {!renamingCategory && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={() => setRenamingCategory({ id: cat._id, name: cat.name })}
                      className="h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-500 hover:text-orange-600 cursor-pointer transition-colors"
                      aria-label="Rename category"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={() => setDeleteItem({ type: 'category', id: cat._id })}
                      className="h-6 w-6 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-500 hover:text-red-500 cursor-pointer transition-colors"
                      aria-label="Delete category"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )}
              </div>
            ))}

          {/* Add category */}
          {showAddCategory ? (
            <form
              className="shrink-0 flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (newCategoryName.trim()) addCategoryMutation.mutate()
              }}
            >
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowAddCategory(false)
                    setNewCategoryName('')
                  }
                }}
                placeholder="Category name"
                className="rounded-full border border-orange-400 bg-orange-50 px-3 py-1.5 text-sm text-gray-900 outline-none w-40 placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={addCategoryMutation.isPending || !newCategoryName.trim()}
                className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
              >
                {addCategoryMutation.isPending ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="shrink-0 flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-400 hover:border-orange-400 hover:text-orange-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus size={13} />
              Category
            </button>
          )}
        </div>
      </div>

      {/* Select-all-in-view toggle (only visible when there are items) */}
      {!loadingItems && filteredItems.length > 0 && (() => {
        const allInViewSelected = filteredItems.every((i) => selectedIds.has(i._id))
        return (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <button
              onClick={toggleSelectAllInView}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-600 transition hover:border-orange-300 hover:text-orange-600 cursor-pointer"
            >
              <span className={`inline-flex h-4 w-4 items-center justify-center rounded ${allInViewSelected ? 'bg-orange-600 text-white' : 'border border-gray-300 bg-white'}`}>
                {allInViewSelected && <Check size={11} strokeWidth={3} />}
              </span>
              {allInViewSelected ? 'Deselect all in view' : `Select all ${filteredItems.length} in view`}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Clear selection ({selectedIds.size})
              </button>
            )}
          </div>
        )
      })()}

      {/* Items grid */}
      {loadingItems ? (
        <LoadingSkeleton />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          hasSearch={!!searchQuery.trim()}
          onAdd={() => router.push('/restaurant/menu/items/new')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <ItemCard
              key={item._id}
              item={item}
              categoryName={categoryMap.get(item.categoryId)}
              onEdit={() => router.push(`/restaurant/menu/items/${item._id}`)}
              onDelete={() => setDeleteItem({ type: 'item', id: item._id })}
              onToggle={(available) =>
                toggleAvailability.mutate({ itemId: item._id, isAvailable: available })
              }
              toggling={togglingItemId === item._id}
              selected={selectedIds.has(item._id)}
              onToggleSelect={() => toggleSelection(item._id)}
            />
          ))}
        </div>
      )}

      {/* Search result count */}
      {searchQuery.trim() && filteredItems.length > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
        </p>
      )}

      {/* Sprint 12 (S12-7): sticky bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 text-white shadow-2xl"
          >
            <span className="mr-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums">
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => bulkAvailabilityMutation.mutate({ isAvailable: true })}
              disabled={bulkAvailabilityMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50 cursor-pointer"
            >
              <Eye size={13} /> Available
            </button>
            <button
              onClick={() => bulkAvailabilityMutation.mutate({ isAvailable: false })}
              disabled={bulkAvailabilityMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              <EyeOff size={13} /> Sold out
            </button>
            <button
              onClick={() => setBulkAction('category')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <Tag size={13} /> Move to…
            </button>
            <button
              onClick={() => setBulkAction('price')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 cursor-pointer"
            >
              <Coins size={13} /> Adjust prices
            </button>
            <button
              onClick={() => setBulkAction('delete')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 cursor-pointer"
            >
              <Trash2 size={13} /> Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              className="ml-auto rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
            {(bulkAvailabilityMutation.isPending || bulkCategoryMutation.isPending || bulkPriceMutation.isPending || bulkDeleteMutation.isPending) && (
              <Loader2 size={14} className="animate-spin text-white/70" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk category modal */}
      <AnimatePresence>
        {bulkAction === 'category' && (
          <BulkCategoryModal
            categories={categories}
            count={selectedIds.size}
            pending={bulkCategoryMutation.isPending}
            onCancel={() => setBulkAction(null)}
            onConfirm={(categoryId) => bulkCategoryMutation.mutate(categoryId)}
          />
        )}
        {bulkAction === 'price' && (
          <BulkPriceModal
            count={selectedIds.size}
            pending={bulkPriceMutation.isPending}
            onCancel={() => setBulkAction(null)}
            onConfirm={(mode, value) => bulkPriceMutation.mutate({ mode, value })}
          />
        )}
      </AnimatePresence>

      {/* Bulk delete confirm — reuses the existing ConfirmDialog for consistency */}
      <ConfirmDialog
        open={bulkAction === 'delete'}
        title={`Delete ${selectedIds.size} items?`}
        description="This cannot be undone. The items will be permanently removed from your menu."
        confirmLabel={`Delete ${selectedIds.size}`}
        confirmVariant="danger"
        loading={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate()}
        onCancel={() => setBulkAction(null)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteItem !== null}
        title={`Delete ${deleteItem?.type === 'category' ? 'Category' : 'Item'}?`}
        description={
          deleteItem?.type === 'category'
            ? 'This will delete the category. Items in this category will not be deleted.'
            : 'This cannot be undone.'
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}

// ── Sprint 12 (S12-7): bulk modals ──────────────────────────────────────────

function BulkCategoryModal({ categories, count, pending, onCancel, onConfirm }: {
  categories: MenuCategory[]
  count:      number
  pending:    boolean
  onCancel:   () => void
  onConfirm:  (categoryId: string) => void
}) {
  const [categoryId, setCategoryId] = useState<string>('')
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1   }}
        exit={{    opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">Move {count} item{count === 1 ? '' : 's'} to category</h2>
          <p className="mt-1 text-xs text-gray-500">All selected items will be reassigned. Existing per-item settings are kept.</p>
        </div>
        <div className="px-6 py-5">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Target category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onCancel} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer">Cancel</button>
          <button
            onClick={() => categoryId && onConfirm(categoryId)}
            disabled={!categoryId || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Move items
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function BulkPriceModal({ count, pending, onCancel, onConfirm }: {
  count:     number
  pending:   boolean
  onCancel:  () => void
  onConfirm: (mode: 'percent' | 'fixed' | 'set', value: number) => void
}) {
  const [mode,  setMode]  = useState<'percent' | 'fixed' | 'set'>('percent')
  const [value, setValue] = useState<string>('')
  const parsed = parseFloat(value)

  // For percent mode the user types a percentage; for fixed/set the user types
  // major currency units (naira) — we convert to kobo for the request.
  const numericValid =
    !Number.isNaN(parsed) &&
    (mode === 'percent'
      ? parsed >= -95 && parsed <= 500
      : mode === 'set'
        ? parsed >= 0
        : true)

  const payloadValue = mode === 'percent' ? parsed : Math.round(parsed * 100)

  const helpText = {
    percent: 'Positive raises, negative lowers. E.g. 10 = +10%, −15 = −15%. Rounded to nearest kobo per item.',
    fixed:   'Add or subtract a fixed naira amount from every selected item. E.g. −50 subtracts ₦50 from each price. Prices cannot go below zero.',
    set:     'Set every selected item to this exact price (in naira). Useful for flash-flat pricing.',
  }[mode]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1   }}
        exit={{    opacity: 0, y: 12, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-extrabold text-gray-900">Adjust prices on {count} item{count === 1 ? '' : 's'}</h2>
          <p className="mt-1 text-xs text-gray-500">Choose a mode, then a value. The change applies to every selected item.</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Mode</label>
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
              {(['percent', 'fixed', 'set'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition cursor-pointer ${
                    mode === m ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m === 'percent' ? 'By percent' : m === 'fixed' ? 'By amount' : 'Set price'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">
              {mode === 'percent' ? 'Percent (%)' : `Amount (${mode === 'fixed' ? '± ' : ''}₦)`}
            </label>
            <input
              type="number"
              step={mode === 'percent' ? '1' : '0.01'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'percent' ? 'e.g. 10 or -15' : mode === 'set' ? 'e.g. 2500' : 'e.g. -50 or 100'}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-lg font-bold tabular-nums outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <p className="mt-1 text-xs text-gray-400">{helpText}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={onCancel} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 cursor-pointer">Cancel</button>
          <button
            onClick={() => numericValid && onConfirm(mode, payloadValue)}
            disabled={!numericValid || pending}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            Apply
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
