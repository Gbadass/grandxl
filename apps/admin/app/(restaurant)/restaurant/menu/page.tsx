'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, menuApi, menuManagementApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { MenuCategory, MenuItem } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

export default function RestaurantMenuPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [deleteItem, setDeleteItem] = useState<{ type: 'category' | 'item'; id: string } | null>(null)
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER)) router.replace('/auth/login')
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
  const items = selectedCategory
    ? allItems.filter((i) => i.categoryId === selectedCategory)
    : allItems

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
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      menuManagementApi.updateItem(restaurantId!, itemId, { isAvailable }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['menu-items', restaurantId] })
    },
    onError: () => toast.error('Failed to update'),
  })

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Menu"
        subtitle="Manage your categories and items"
        action={
          <button
            onClick={() => router.push('/restaurant/menu/items/new')}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            + Add Item
          </button>
        }
      />

      <div className="flex gap-6">
        {/* Categories sidebar */}
        <div className="w-56 flex-shrink-0">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">Categories</span>
              <button
                onClick={() => setShowAddCategory(true)}
                className="text-sm text-orange-600 hover:text-orange-600"
              >
                + Add
              </button>
            </div>
            {loadingCats ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : (
              <nav className="p-2 space-y-0.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedCategory === null
                      ? 'bg-orange-50 font-medium text-orange-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All items
                </button>
                {categories.map((cat) => (
                  <div key={cat._id} className="group flex items-center gap-1">
                    {renamingCategory?.id === cat._id ? (
                      <form
                        className="flex flex-1 items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (renamingCategory.name.trim())
                            renameMutation.mutate({ catId: cat._id, name: renamingCategory.name })
                        }}
                      >
                        <input
                          autoFocus
                          value={renamingCategory.name}
                          onChange={(e) => setRenamingCategory((r) => r ? { ...r, name: e.target.value } : r)}
                          onBlur={() => setRenamingCategory(null)}
                          onKeyDown={(e) => e.key === 'Escape' && setRenamingCategory(null)}
                          className="flex-1 rounded border border-orange-300 px-2 py-1 text-sm focus:outline-none"
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => setSelectedCategory(cat._id)}
                        onDoubleClick={() => setRenamingCategory({ id: cat._id, name: cat.name })}
                        title="Double-click to rename"
                        className={`flex-1 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedCategory === cat._id
                            ? 'bg-orange-50 font-medium text-orange-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteItem({ type: 'category', id: cat._id })}
                      className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1">
          {loadingItems ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
              <div className="text-center">
                <p className="text-gray-400">No items in this category yet</p>
                <button
                  onClick={() => router.push('/restaurant/menu/items/new')}
                  className="mt-2 text-sm text-orange-600 hover:underline"
                >
                  Add your first item →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-14 w-14 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-gray-400 truncate">{item.description}</p>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatMoney(item.basePrice, 'NGN')}
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={item.isAvailable}
                      onChange={(e) =>
                        toggleAvailability.mutate({
                          itemId: item._id,
                          isAvailable: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                  <button
                    onClick={() => router.push(`/restaurant/menu/items/${item._id}`)}
                    className="text-sm text-gray-400 hover:text-gray-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteItem({ type: 'item', id: item._id })}
                    className="text-sm text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add category dialog */}
      <ConfirmDialog
        open={showAddCategory}
        title="Add Category"
        confirmLabel="Add"
        loading={addCategoryMutation.isPending}
        onConfirm={() => addCategoryMutation.mutate()}
        onCancel={() => { setShowAddCategory(false); setNewCategoryName('') }}
      >
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Category name (e.g. Burgers)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          autoFocus
        />
      </ConfirmDialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteItem !== null}
        title={`Delete ${deleteItem?.type === 'category' ? 'Category' : 'Item'}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}
