'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { platformConfigApi } from '@grandxl/api-client'
import { UserRole } from '@grandxl/types'
import { formatMoney, parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../src/store/auth.store'
import { PageHeader } from '../../../src/components/ui/PageHeader'
import '../../../src/lib/axios'

const SERVICE_DEFS = [
  {
    id: 'instamart' as const,
    label: 'Instamart',
    description: 'Grocery & convenience items delivered fast',
    icon: '🛒',
  },
  {
    id: 'dineout' as const,
    label: 'Dine Out',
    description: 'Restaurant table booking and dine-in experiences',
    icon: '🍽️',
  },
  {
    id: 'drinks' as const,
    label: 'Drinks',
    description: 'Beverages, juices, and alcohol delivery',
    icon: '🧃',
  },
]

export default function PlatformSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isInitializing, user } = useAuthStore()
  const qc = useQueryClient()

  const [commission, setCommission] = useState('')
  const [minRiderEarning, setMinRiderEarning] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [services, setServices] = useState({ instamart: false, dineout: false, drinks: false })

  useEffect(() => {
    if (isInitializing) return
    if (!isAuthenticated || !user?.roles?.includes(UserRole.SUPER_ADMIN)) router.replace('/auth/login')
  }, [isAuthenticated, isInitializing, user, router])

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'config'],
    queryFn: () => platformConfigApi.get(),
    enabled: isAuthenticated,
  })

  const config = data?.data?.data

  useEffect(() => {
    if (config && !loaded) {
      setCommission(String(config.platformCommissionPercent))
      setMinRiderEarning(String((config.minRiderEarningKobo / 100).toFixed(0)))
      setServices({
        instamart: config.enabledServices?.instamart ?? false,
        dineout:   config.enabledServices?.dineout   ?? false,
        drinks:    config.enabledServices?.drinks     ?? false,
      })
      setLoaded(true)
    }
  }, [config, loaded])

  const mutation = useMutation({
    mutationFn: () =>
      platformConfigApi.update({
        platformCommissionPercent: Number(commission),
        minRiderEarningKobo: Math.round(Number(minRiderEarning) * 100),
      }),
    onSuccess: () => {
      toast.success('Platform settings saved')
      void qc.invalidateQueries({ queryKey: ['platform', 'config'] })
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to save settings')),
  })

  const servicesMutation = useMutation({
    mutationFn: (updated: typeof services) =>
      platformConfigApi.update({ enabledServices: updated }),
    onSuccess: () => {
      toast.success('Services updated')
      void qc.invalidateQueries({ queryKey: ['platform', 'config'] })
    },
    onError: (e) => toast.error(parseApiError(e, 'Failed to update services')),
  })

  function toggleService(id: keyof typeof services) {
    const updated = { ...services, [id]: !services[id] }
    setServices(updated)
    servicesMutation.mutate(updated)
  }

  if (isInitializing) return null

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform-wide configuration" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Commission & Earnings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 font-semibold text-gray-900">Revenue Settings</h2>
          <p className="mb-5 text-sm text-gray-400">Controls platform take rate and minimum rider pay.</p>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Platform Commission (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-10 text-sm text-gray-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">GrandXL takes this % from each restaurant's order revenue.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Minimum Rider Earning per Delivery (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={minRiderEarning}
                    onChange={(e) => setMinRiderEarning(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm text-gray-900 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Riders will always earn at least this amount per completed delivery.</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || !commission || !minRiderEarning}
                  className="rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {mutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* App Services */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 font-semibold text-gray-900">App Services</h2>
          <p className="mb-5 text-sm text-gray-400">Toggle which services are live in the mobile app. Disabled services show "Coming Soon" to customers.</p>

          <div className="space-y-3">
            {/* Food is always on */}
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">🍔</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Food Delivery</p>
                  <p className="text-xs text-gray-400">Core service — always enabled</p>
                </div>
              </div>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Always On</span>
            </div>

            {SERVICE_DEFS.map((svc) => {
              const isOn = services[svc.id]
              return (
                <div key={svc.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{svc.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{svc.label}</p>
                      <p className="text-xs text-gray-400">{svc.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleService(svc.id)}
                    disabled={servicesMutation.isPending}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      isOn ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={isOn}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Changes take effect immediately — the mobile app reads this config on each launch.
          </p>
        </div>

        {/* Delivery Tiers */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-1 font-semibold text-gray-900">Delivery Fee Tiers</h2>
          <p className="mb-5 text-sm text-gray-400">Distance-based pricing applied to customer orders.</p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100" />)}
            </div>
          ) : !config?.deliveryTiers?.length ? (
            <p className="text-sm text-gray-400">No delivery tiers configured.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Up to (km)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Delivery Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {config.deliveryTiers.map((tier, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">{tier.maxKm} km</td>
                      <td className="px-4 py-3 text-gray-700">{formatMoney(tier.feeKobo, 'NGN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Delivery tiers are configured at the infrastructure level. Contact engineering to adjust tier ranges.
          </p>
        </div>

        {/* Last updated */}
        {config?.updatedAt && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-400">
            Last updated: {new Date(config.updatedAt).toLocaleString('en-NG', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
        )}
      </div>
    </div>
  )
}
