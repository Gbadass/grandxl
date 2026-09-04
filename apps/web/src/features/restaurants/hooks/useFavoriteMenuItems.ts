import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../store/auth.store'

// S14-10: React-Query-backed cache of the user's favorite menu-item IDs, plus
// toggle mutations. Signed-in only — signed-out users see empty favorites and
// tapping the heart still works optimistically-nothing (the button is hidden
// when there's no user, see MenuItemCard).

const KEY = ['favorite-menu-items'] as const

export function useFavoriteMenuItems() {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const { data: ids = [] } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await usersApi.listFavoriteItems()
      return res.data.data
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  })

  const idSet = new Set(ids)
  function isFavorite(menuItemId: string): boolean {
    return idSet.has(menuItemId)
  }

  const add = useMutation({
    mutationFn: (menuItemId: string) => usersApi.addFavoriteItem(menuItemId),
    onMutate: async (menuItemId) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<string[]>(KEY) ?? []
      qc.setQueryData<string[]>(KEY, [...prev, menuItemId])
      return { prev }
    },
    onError: (_err, _var, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  const remove = useMutation({
    mutationFn: (menuItemId: string) => usersApi.removeFavoriteItem(menuItemId),
    onMutate: async (menuItemId) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<string[]>(KEY) ?? []
      qc.setQueryData<string[]>(KEY, prev.filter((id) => id !== menuItemId))
      return { prev }
    },
    onError: (_err, _var, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  function toggle(menuItemId: string): void {
    if (idSet.has(menuItemId)) remove.mutate(menuItemId)
    else add.mutate(menuItemId)
  }

  return { ids, isFavorite, toggle, canFavorite: Boolean(user) }
}
