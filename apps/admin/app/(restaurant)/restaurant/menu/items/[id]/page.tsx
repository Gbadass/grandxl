'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, menuApi, menuManagementApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { MenuCategory } from '@grandxl/types'
import { useAuthStore } from '../../../../../../src/store/auth.store'
import { PageHeader } from '../../../../../../src/components/ui/PageHeader'
import '../../../../../../src/lib/axios'

export default function EditMenuItemPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    allergens: '',
    isAvailable: true,
  })
  const [loaded, setLoaded] = useState(false)

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

  const { data: categoriesData } = useQuery({
    queryKey: ['menu-categories', restaurantId],
    queryFn: () => menuApi.getCategories(restaurantId!),
    enabled: !!restaurantId,
  })

  const categories = (categoriesData?.data?.data ?? []) as MenuCategory[]

  const { data: itemData } = useQuery({
    queryKey: ['menu-item', restaurantId, id],
    queryFn: () => menuApi.getItemById(restaurantId!, id),
    enabled: !!restaurantId && !!id,
  })

  useEffect(() => {
    const item = itemData?.data?.data
    if (item && !loaded) {
      setForm({
        name: item.name,
        description: item.description ?? '',
        price: (item.basePrice / 100).toFixed(2),
        categoryId: item.categoryId,
        allergens: item.allergens?.join(', ') ?? '',
        isAvailable: item.isAvailable,
      })
      setLoaded(true)
    }
  }, [itemData, loaded])

  const updateMutation = useMutation({
    mutationFn: () =>
      menuManagementApi.updateItem(restaurantId!, id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: Math.round(parseFloat(form.price) * 100),
        categoryId: form.categoryId,
        isAvailable: form.isAvailable,
        allergens: form.allergens
          ? form.allergens.split(',').map((a) => a.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      toast.success('Item updated')
      void qc.invalidateQueries({ queryKey: ['menu-items', restaurantId] })
      router.push('/restaurant/menu')
    },
    onError: () => toast.error('Update failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error('Valid price is required'); return }
    updateMutation.mutate()
  }

  if (isInitializing || !loaded) {
    return <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
  }

  return (
    <div>
      <PageHeader
        title="Edit Menu Item"
        action={
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ← Back
          </button>
        }
      />

      <div className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
          <Field label="Item name *">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className={inputCls}
            />
          </Field>

          <Field label="Price (₦) *">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className={inputCls}
            />
          </Field>

          <Field label="Category *">
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={inputCls}
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Allergens (comma-separated)">
            <input
              value={form.allergens}
              onChange={(e) => setForm((f) => ({ ...f, allergens: e.target.value }))}
              placeholder="e.g. nuts, gluten, dairy"
              className={inputCls}
            />
          </Field>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm text-gray-600">Available for order</span>
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
