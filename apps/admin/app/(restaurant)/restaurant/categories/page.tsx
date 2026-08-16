'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, foodCategoriesApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { FoodCategory } from '@grandxl/types'
import { useAuthStore } from '../../../../src/store/auth.store'
import { PageHeader } from '../../../../src/components/ui/PageHeader'
import { ConfirmDialog } from '../../../../src/components/ui/ConfirmDialog'
import '../../../../src/lib/axios'

const UNSPLASH_PRESETS = [
  { label: 'Burgers',  url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&h=120&fit=crop&q=75' },
  { label: 'Rice',     url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=120&h=120&fit=crop&q=75' },
  { label: 'Chicken',  url: 'https://images.unsplash.com/photo-1598514982641-e924c324d23a?w=120&h=120&fit=crop&q=75' },
  { label: 'Pizza',    url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=120&h=120&fit=crop&q=75' },
  { label: 'Shawarma', url: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=120&h=120&fit=crop&q=75' },
  { label: 'Soups',    url: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=120&h=120&fit=crop&q=75' },
  { label: 'Seafood',  url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=120&h=120&fit=crop&q=75' },
  { label: 'Desserts', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=120&h=120&fit=crop&q=75' },
  { label: 'Nigerian', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=120&h=120&fit=crop&q=75' },
  { label: 'Pasta',    url: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=120&h=120&fit=crop&q=75' },
]

export default function FoodCategoriesPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FoodCategory | null>(null)
  const [editTarget, setEditTarget] = useState<FoodCategory | null>(null)
  const [editName, setEditName] = useState('')
  const [editImage, setEditImage] = useState('')

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

  const { data, isLoading } = useQuery({
    queryKey: ['food-categories'],
    queryFn: () => foodCategoriesApi.getAll(),
  })

  const categories = (data?.data?.data ?? []) as FoodCategory[]

  const createMutation = useMutation({
    mutationFn: () => foodCategoriesApi.create({ name: name.trim(), image: imageUrl.trim() || undefined }),
    onSuccess: () => {
      toast.success('Category created')
      qc.invalidateQueries({ queryKey: ['food-categories'] })
      setName('')
      setImageUrl('')
      setShowForm(false)
    },
    onError: () => toast.error('Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: (cat: FoodCategory) =>
      foodCategoriesApi.update(cat._id, {
        name: editName.trim() || undefined,
        image: editImage.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Category updated')
      qc.invalidateQueries({ queryKey: ['food-categories'] })
      setEditTarget(null)
    },
    onError: () => toast.error('Failed to update category'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      foodCategoriesApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food-categories'] }),
    onError: () => toast.error('Failed to toggle category'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => foodCategoriesApi.remove(id),
    onSuccess: () => {
      toast.success('Category deleted')
      qc.invalidateQueries({ queryKey: ['food-categories'] })
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete category'),
  })

  const startEdit = (cat: FoodCategory) => {
    setEditTarget(cat)
    setEditName(cat.name)
    setEditImage(cat.image ?? '')
  }

  return (
    <div>
      <PageHeader
        title="Food Categories"
        subtitle="Categories appear in the 'What's on your mind?' section of the customer app"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600 transition-colors"
          >
            <span>+</span> New Category
          </button>
        }
      />

      {/* ── Add Form ── */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-zinc-700">New Category</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Category name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jollof Rice, Shawarma, Burgers"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Image URL (optional)</label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              {/* Presets */}
              <p className="mt-2 mb-1.5 text-xs text-zinc-400">Or pick a preset photo:</p>
              <div className="flex flex-wrap gap-2">
                {UNSPLASH_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setImageUrl(p.url)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      imageUrl === p.url
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <img src={p.url} alt={p.label} className="h-5 w-5 rounded-full object-cover" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {imageUrl && (
              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-14 w-14 rounded-full object-cover border-2 border-orange-300"
                  onError={(e) => { (e.target as HTMLImageElement).src = '' }}
                />
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{name || 'Category name'}</p>
                  <p className="text-xs text-zinc-400">Preview</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name.trim() || createMutation.isPending}
                className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Saving…' : 'Create Category'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setImageUrl('') }}
                className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-semibold text-zinc-700">Edit Category</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Image URL</label>
                <input
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {UNSPLASH_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setEditImage(p.url)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        editImage === p.url
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <img src={p.url} alt={p.label} className="h-5 w-5 rounded-full object-cover" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => updateMutation.mutate(editTarget)}
                  disabled={updateMutation.isPending}
                  className="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditTarget(null)}
                  className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-16 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">🍽️</div>
          <p className="text-sm font-semibold text-zinc-700">No categories yet</p>
          <p className="mt-1 text-xs text-zinc-400">Create your first food category to appear in the app</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Create Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className={`relative flex flex-col items-center rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                cat.isActive ? 'border-zinc-200' : 'border-zinc-100 opacity-50'
              }`}
            >
              {/* Image */}
              <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-zinc-100 bg-zinc-100">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                )}
              </div>

              <p className="mb-0.5 text-sm font-semibold text-zinc-800 text-center leading-tight">{cat.name}</p>
              <p className="text-[10px] text-zinc-400 font-mono">{cat.slug}</p>

              {/* Active badge */}
              <span className={`mt-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                cat.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-zinc-100 text-zinc-500'
              }`}>
                {cat.isActive ? 'Visible' : 'Hidden'}
              </span>

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => startEdit(cat)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleMutation.mutate({ id: cat._id, isActive: !cat.isActive })}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  {cat.isActive ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="rounded-lg border border-red-100 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Category"
        description={`Remove "${deleteTarget?.name}" from the app? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
