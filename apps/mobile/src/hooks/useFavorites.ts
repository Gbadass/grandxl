import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

// Single source of truth for "is restaurant X favorited?" — fetched once, mutated optimistically.
export function useFavorites() {
  const { isAuthenticated } = useAuthStore()
  const qc = useQueryClient()

  const { data: ids = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn:  () => usersApi.listFavorites().then((r) => r.data.data),
    enabled:  isAuthenticated,
    staleTime: 60_000,
  })

  const set = useMemo(() => new Set(ids), [ids])

  const addMutation = useMutation({
    mutationFn: (restaurantId: string) => usersApi.addFavorite(restaurantId),
    onMutate: async (restaurantId) => {
      await qc.cancelQueries({ queryKey: ['favorites'] })
      const prev = qc.getQueryData<string[]>(['favorites']) ?? []
      qc.setQueryData(['favorites'], [...prev, restaurantId])
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favorites'], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (restaurantId: string) => usersApi.removeFavorite(restaurantId),
    onMutate: async (restaurantId) => {
      await qc.cancelQueries({ queryKey: ['favorites'] })
      const prev = qc.getQueryData<string[]>(['favorites']) ?? []
      qc.setQueryData(['favorites'], prev.filter((id) => id !== restaurantId))
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['favorites'], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  return {
    ids,
    isFavorited:    (restaurantId: string) => set.has(restaurantId),
    toggleFavorite: (restaurantId: string) => {
      if (set.has(restaurantId)) removeMutation.mutate(restaurantId)
      else                       addMutation.mutate(restaurantId)
    },
    isLoading,
  }
}
