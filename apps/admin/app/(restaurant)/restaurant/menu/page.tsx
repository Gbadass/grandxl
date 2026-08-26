'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Search, Plus, Pencil, Trash2, UtensilsCrossed, Clock,
  ChevronRight, X, Package, CheckCircle2, XCircle,
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
}: {
  item: MenuItem
  categoryName: string | undefined
  onEdit: () => void
  onDelete: () => void
  onToggle: (available: boolean) => void
  toggling: boolean
}) {
  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        !item.isAvailable ? 'opacity-75' : ''
      }`}
    >
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
