'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { myRestaurantApi, menuApi, menuManagementApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { MenuCategory } from '@grandxl/types'
import { useAuthStore } from '../../../../../../src/store/auth.store'
import { PageHeader } from '../../../../../../src/components/ui/PageHeader'
import '../../../../../../src/lib/axios'

export default function NewMenuItemPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    preparationTime: '',
    isAvailable: true,
  })

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

  const createMutation = useMutation({
    mutationFn: () =>
      menuManagementApi.createItem(restaurantId!, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        basePrice: Math.round(parseFloat(form.price) * 100), // naira → kobo
        categoryId: form.categoryId,
        isAvailable: form.isAvailable,
      }),
    onSuccess: () => {
      toast.success('Item added')
      router.push('/restaurant/menu')
    },
    onError: () => toast.error('Failed to add item'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error('Valid price is required'); return }
    if (!form.categoryId) { toast.error('Select a category'); return }
    createMutation.mutate()
  }

  if (isInitializing) return null

  return (
    <div>
      <PageHeader
        title="Add Menu Item"
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
              placeholder="e.g. Jollof Rice & Chicken"
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Short description..."
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
              placeholder="0.00"
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
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prep time (minutes)">
            <input
              type="number"
              min="1"
              max="120"
              value={form.preparationTime}
              onChange={(e) => setForm((f) => ({ ...f, preparationTime: e.target.value }))}
              placeholder="e.g. 15"
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
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Adding…' : 'Add Item'}
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
