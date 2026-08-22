import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@grandxl/api-client'
import { useAuthStore } from '../../../store/auth.store'
import { useCartStore } from '../../cart/store/cart.store'
import { queryClient } from '../../../lib/queryClient'
import { ROUTES } from '../../../router/routes'

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const clearCart = useCartStore((s) => s.clearCart)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Always clear local state even if the API call fails
      clearAuth()
      clearCart()
      queryClient.clear()
      navigate(ROUTES.LOGIN)
    },
  })
}
