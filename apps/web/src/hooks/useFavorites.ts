import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

export function useFavorites() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const qc = useQueryClient()

  // listFavorites returns ApiResponse<string[]> — the data field is an array of restaurant IDs
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const res = await usersApi.listFavorites()
      return res.data.data
    },
    enabled: isAuthenticated,
  })

  const favoriteSet = new Set(favoriteIds)

  const toggle = useMutation({
    mutationFn: async (restaurantId: string) => {
      if (favoriteSet.has(restaurantId)) {
        await usersApi.removeFavorite(restaurantId)
      } else {
        await usersApi.addFavorite(restaurantId)
      }
    },
    onMutate: async (restaurantId: string) => {
      await qc.cancelQueries({ queryKey: ['favorites'] })
      const previous = qc.getQueryData<string[]>(['favorites'])
      qc.setQueryData<string[]>(['favorites'], (old = []) =>
        favoriteSet.has(restaurantId)
          ? old.filter((id) => id !== restaurantId)
          : [...old, restaurantId],
      )
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(['favorites'], ctx.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  return {
    favoriteIds: favoriteSet,
    isFavorited: (restaurantId: string) => favoriteSet.has(restaurantId),
    toggleFavorite: toggle.mutate,
    isPending: toggle.isPending,
  }
}
