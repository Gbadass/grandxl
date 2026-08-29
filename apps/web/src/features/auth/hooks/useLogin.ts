import { useMutation } from '@tanstack/react-query'
import { authApi, type LoginDto } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (dto: LoginDto) => authApi.login(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
    },
    onError: (err: unknown) => {
      notify.error(parseApiError(err, 'Login failed'))
    },
  })
}
