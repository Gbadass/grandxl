import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../store/auth.store'
import { queryClient } from '../../../lib/queryClient'
import { ROUTES } from '../../../router/routes'

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Always clear local state even if the API call fails
      clearAuth()
      queryClient.clear()
      navigate(ROUTES.LOGIN)
    },
  })
}
