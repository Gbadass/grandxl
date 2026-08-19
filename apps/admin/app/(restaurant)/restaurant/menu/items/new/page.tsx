'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ImageIcon, Loader2, X } from 'lucide-react'
import { myRestaurantApi, menuApi, menuManagementApi, uploadsApi } from '@grandxl/api-client'
import type { CreateMenuItemVariant, CreateMenuItemAddOn } from '@grandxl/api-client'
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

  const [variants, setVariants] = useState<CreateMenuItemVariant[]>([])
  const [addOns, setAddOns] = useState<CreateMenuItemAddOn[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

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

  // ── Variant helpers ──────────────────────────────────────────────────────────

  function addVariant() {
    setVariants((v) => [...v, { name: '', isRequired: false, options: [] }])
  }

  function removeVariant(vi: number) {
    setVariants((v) => v.filter((_, i) => i !== vi))
  }

  function updateVariantField(vi: number, field: 'name' | 'isRequired', value: string | boolean) {
    setVariants((v) =>
      v.map((variant, i) =>
        i === vi ? { ...variant, [field]: value } : variant,
      ),
    )
  }

  function addVariantOption(vi: number) {
    setVariants((v) =>
      v.map((variant, i) =>
        i === vi
          ? { ...variant, options: [...variant.options, { name: '', priceAdjustment: 0 }] }
          : variant,
      ),
    )
  }

  function removeVariantOption(vi: number, oi: number) {
    setVariants((v) =>
      v.map((variant, i) =>
        i === vi
          ? { ...variant, options: variant.options.filter((_, j) => j !== oi) }
          : variant,
      ),
    )
  }

  function updateVariantOption(
    vi: number,
    oi: number,
    field: 'name' | 'priceAdjustment',
    value: string,
  ) {
    setVariants((v) =>
      v.map((variant, i) =>
        i === vi
          ? {
              ...variant,
              options: variant.options.map((opt, j) =>
                j === oi
                  ? {
                      ...opt,
                      [field]:
                        field === 'priceAdjustment'
                          ? Math.round(parseFloat(value || '0') * 100)
                          : value,
                    }
                  : opt,
              ),
            }
          : variant,
      ),
    )
  }

  // ── Add-on helpers ───────────────────────────────────────────────────────────

  function addAddOn() {
    setAddOns((a) => [...a, { name: '', price: 0, isAvailable: true }])
  }

  function removeAddOn(ai: number) {
    setAddOns((a) => a.filter((_, i) => i !== ai))
  }

  function updateAddOnField(ai: number, field: 'name' | 'price' | 'isAvailable', value: string | boolean) {
    setAddOns((a) =>
      a.map((addOn, i) =>
        i === ai
          ? {
              ...addOn,
              [field]:
                field === 'price'
                  ? Math.round(parseFloat(value as string || '0') * 100)
                  : value,
            }
          : addOn,
      ),
    )
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    try {
      const res = await uploadsApi.uploadMenuItemPhoto(file)
      setImageUrl(res.data.data.url)
    } catch {
      toast.error('Image upload failed')
    } finally {
      setImageUploading(false)
      e.target.value = ''
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () =>
      menuManagementApi.createItem(restaurantId!, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        basePrice: Math.round(parseFloat(form.price) * 100), // naira → kobo
        categoryId: form.categoryId,
        isAvailable: form.isAvailable,
        prepTimeMinutes: form.preparationTime ? parseInt(form.preparationTime, 10) : undefined,
        image: imageUrl ?? undefined,
        ...(variants.length > 0 ? { variants } : {}),
        ...(addOns.length > 0 ? { addOns } : {}),
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

          {/* Item Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Item Image</label>
            <div className="flex items-center gap-4">
              {imageUrl ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                  <img src={imageUrl} alt="Menu item" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {imageUploading ? <Loader2 size={20} className="animate-spin text-gray-400" /> : <ImageIcon size={20} className="text-gray-400" />}
                  <span className="text-[10px] text-gray-400">{imageUploading ? 'Uploading…' : 'Add photo'}</span>
                </button>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </div>

          {/* ── Variants ─────────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Variants</h3>
              <button
                type="button"
                onClick={addVariant}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                + Add variant
              </button>
            </div>

            {variants.length === 0 && (
              <p className="text-xs text-gray-400">
                No variants yet — e.g. Size, Spice level
              </p>
            )}

            <div className="space-y-4">
              {variants.map((variant, vi) => (
                <div key={vi} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <input
                      value={variant.name}
                      onChange={(e) => updateVariantField(vi, 'name', e.target.value)}
                      placeholder="Variant name (e.g. Size)"
                      className={inputCls + ' flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(vi)}
                      className="shrink-0 rounded-lg border border-red-200 px-2.5 py-2 text-xs text-red-500 hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={variant.isRequired}
                        onChange={(e) => updateVariantField(vi, 'isRequired', e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                    <span className="text-xs text-gray-600">Required selection</span>
                  </div>

                  <div className="space-y-2">
                    {variant.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          value={opt.name}
                          onChange={(e) => updateVariantOption(vi, oi, 'name', e.target.value)}
                          placeholder="Option name (e.g. Large)"
                          className={inputCls + ' flex-1'}
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={opt.priceAdjustment / 100}
                          onChange={(e) => updateVariantOption(vi, oi, 'priceAdjustment', e.target.value)}
                          placeholder="Price adj. (₦)"
                          className={inputCls + ' w-32'}
                        />
                        <button
                          type="button"
                          onClick={() => removeVariantOption(vi, oi)}
                          className="shrink-0 rounded-lg border border-red-200 px-2.5 py-2 text-xs text-red-500 hover:bg-red-50"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addVariantOption(vi)}
                    className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700"
                  >
                    + Add option
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Add-ons ───────────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Add-ons</h3>
              <button
                type="button"
                onClick={addAddOn}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                + Add add-on
              </button>
            </div>

            {addOns.length === 0 && (
              <p className="text-xs text-gray-400">
                No add-ons yet — e.g. Extra sauce, Drinks
              </p>
            )}

            <div className="space-y-2">
              {addOns.map((addOn, ai) => (
                <div key={ai} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <input
                    value={addOn.name}
                    onChange={(e) => updateAddOnField(ai, 'name', e.target.value)}
                    placeholder="Add-on name (e.g. Extra sauce)"
                    className={inputCls + ' flex-1'}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addOn.price / 100}
                    onChange={(e) => updateAddOnField(ai, 'price', e.target.value)}
                    placeholder="Price (₦)"
                    className={inputCls + ' w-28'}
                  />
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={addOn.isAvailable}
                      onChange={(e) => updateAddOnField(ai, 'isAvailable', e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAddOn(ai)}
                    className="shrink-0 rounded-lg border border-red-200 px-2.5 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
