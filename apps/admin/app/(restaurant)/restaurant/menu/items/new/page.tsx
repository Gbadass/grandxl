'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ImageIcon, Loader2, X, ArrowLeft, Plus, Trash2,
  UtensilsCrossed, Clock, Tag, GripVertical,
} from 'lucide-react'
import { myRestaurantApi, menuApi, menuManagementApi, uploadsApi } from '@grandxl/api-client'
import type { CreateMenuItemVariant, CreateMenuItemAddOn } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import type { MenuCategory } from '@grandxl/types'
import { formatMoney } from '@grandxl/utils'
import { useAuthStore } from '../../../../../../src/store/auth.store'
import '../../../../../../src/lib/axios'

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 transition'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function FormSection({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
            {icon}
          </div>
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
        </div>
        {action}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

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
    if (!isAuthenticated || !user?.roles?.includes(UserRole.RESTAURANT_OWNER))
      router.replace('/auth/login')
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
    setVariants((v) => v.map((variant, i) => (i === vi ? { ...variant, [field]: value } : variant)))
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
  function updateVariantOption(vi: number, oi: number, field: 'name' | 'priceAdjustment', value: string) {
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
        basePrice: Math.round(parseFloat(form.price) * 100),
        categoryId: form.categoryId,
        isAvailable: form.isAvailable,
        prepTimeMinutes: form.preparationTime ? parseInt(form.preparationTime, 10) : undefined,
        image: imageUrl ?? undefined,
        ...(variants.length > 0 ? { variants } : {}),
        ...(addOns.length > 0 ? { addOns } : {}),
      }),
    onSuccess: () => {
      toast.success('Item added to menu')
      router.push('/restaurant/menu')
    },
    onError: () => toast.error('Failed to add item'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Item name is required'); return }
    if (!form.price || isNaN(parseFloat(form.price))) { toast.error('Valid price is required'); return }
    if (!form.categoryId) { toast.error('Please select a category'); return }
    createMutation.mutate()
  }

  if (isInitializing) return null

  const priceNum = parseFloat(form.price) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add Menu Item</h1>
          <p className="text-sm text-gray-400">Fill in the details below to add a new item</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left: form */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basic info */}
            <FormSection
              icon={<Tag size={15} />}
              title="Basic Info"
            >
              <Field label="Item name" hint="required">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jollof Rice & Chicken"
                  className={inputCls}
                  maxLength={80}
                />
              </Field>

              <Field label="Description">
                <div className="relative">
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value.slice(0, 200) }))
                    }
                    placeholder="Short description visible to customers…"
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                  <span
                    className={`absolute bottom-2 right-3 text-[10px] ${
                      form.description.length >= 190
                        ? 'text-red-400'
                        : form.description.length >= 150
                        ? 'text-amber-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {form.description.length}/200
                  </span>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price" hint="required">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      ₦
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      className={inputCls + ' pl-8'}
                    />
                  </div>
                </Field>

                <Field label="Prep time">
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={form.preparationTime}
                      onChange={(e) => setForm((f) => ({ ...f, preparationTime: e.target.value }))}
                      placeholder="15"
                      className={inputCls + ' pr-10'}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      min
                    </span>
                  </div>
                </Field>
              </div>

              <Field label="Category" hint="required">
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

              {/* Availability */}
              <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Available for order</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.isAvailable ? 'Customers can order this item' : 'Item is hidden from customers'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isAvailable}
                  onClick={() => setForm((f) => ({ ...f, isAvailable: !f.isAvailable }))}
                  className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${
                    form.isAvailable ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      form.isAvailable ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </FormSection>

            {/* Variants */}
            <FormSection
              icon={<GripVertical size={15} />}
              title="Variants"
              action={
                <button
                  type="button"
                  onClick={addVariant}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  Add variant
                </button>
              }
            >
              {variants.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">
                  No variants yet — add Size, Spice level, Protein choice, etc.
                </p>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant, vi) => (
                    <div key={vi} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={variant.name}
                          onChange={(e) => updateVariantField(vi, 'name', e.target.value)}
                          placeholder="Variant name (e.g. Size)"
                          className={inputCls + ' flex-1'}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={variant.isRequired}
                            onClick={() => updateVariantField(vi, 'isRequired', !variant.isRequired)}
                            className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${
                              variant.isRequired ? 'bg-orange-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                variant.isRequired ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-xs text-gray-500 whitespace-nowrap">Required</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariant(vi)}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="space-y-2">
                        {variant.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <GripVertical size={14} className="text-gray-300 shrink-0" />
                            <input
                              value={opt.name}
                              onChange={(e) => updateVariantOption(vi, oi, 'name', e.target.value)}
                              placeholder="Option (e.g. Large)"
                              className={inputCls + ' flex-1'}
                            />
                            <div className="relative w-28 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">+₦</span>
                              <input
                                type="number"
                                step="0.01"
                                value={opt.priceAdjustment / 100}
                                onChange={(e) => updateVariantOption(vi, oi, 'priceAdjustment', e.target.value)}
                                placeholder="0"
                                className={inputCls + ' pl-7'}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVariantOption(vi, oi)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addVariantOption(vi)}
                        className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        <Plus size={12} />
                        Add option
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            {/* Add-ons */}
            <FormSection
              icon={<Plus size={15} />}
              title="Add-ons"
              action={
                <button
                  type="button"
                  onClick={addAddOn}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  Add add-on
                </button>
              }
            >
              {addOns.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">
                  No add-ons yet — Extra sauce, Drinks, Dessert, etc.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_7rem_auto_2rem] gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1">
                    <span>Name</span>
                    <span>Price (₦)</span>
                    <span>Available</span>
                    <span />
                  </div>
                  {addOns.map((addOn, ai) => (
                    <div
                      key={ai}
                      className="grid grid-cols-[1fr_7rem_auto_2rem] gap-2 items-center rounded-xl bg-gray-50 border border-gray-100 px-3 py-2"
                    >
                      <input
                        value={addOn.name}
                        onChange={(e) => updateAddOnField(ai, 'name', e.target.value)}
                        placeholder="Extra sauce"
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-100 transition"
                      />
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₦</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={addOn.price / 100}
                          onChange={(e) => updateAddOnField(ai, 'price', e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border border-gray-200 bg-white pl-6 pr-2.5 py-1.5 text-sm placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-100 transition"
                        />
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={addOn.isAvailable}
                        onClick={() => updateAddOnField(ai, 'isAvailable', !addOn.isAvailable)}
                        className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer mx-auto block ${
                          addOn.isAvailable ? 'bg-orange-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                            addOn.isAvailable ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAddOn(ai)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </div>

          {/* Right: Image + Preview */}
          <div className="space-y-4 lg:sticky lg:top-6">
            {/* Image upload */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
                <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                  <ImageIcon size={15} />
                </div>
                <span className="font-semibold text-gray-800 text-sm">Item Photo</span>
              </div>
              <div className="p-5">
                {imageUrl ? (
                  <div className="relative w-full rounded-xl overflow-hidden aspect-[4/3] bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Menu item" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 hover:border-orange-400 hover:bg-orange-50/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {imageUploading ? (
                      <>
                        <Loader2 size={28} className="animate-spin text-orange-400" />
                        <span className="text-sm text-gray-400">Uploading…</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={28} className="text-gray-300" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-500">Click to upload photo</p>
                          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · up to 5MB</p>
                        </div>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer Preview</span>
              </div>
              <div className="p-4">
                <div className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="aspect-[4/3] bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UtensilsCrossed size={24} className="text-orange-200" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                        {form.name || 'Item name'}
                      </p>
                      <p className="font-bold text-orange-600 text-sm whitespace-nowrap">
                        {priceNum > 0 ? formatMoney(Math.round(priceNum * 100), 'NGN') : '₦0.00'}
                      </p>
                    </div>
                    {form.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{form.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {form.preparationTime && (
                        <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          <Clock size={9} />
                          {form.preparationTime}m
                        </span>
                      )}
                      {!form.isAvailable && (
                        <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-[10px] font-medium">
                          Sold out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-2xl bg-orange-600 py-3.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors cursor-pointer min-h-[52px] flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Adding to menu…
                </>
              ) : (
                'Add to menu'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
