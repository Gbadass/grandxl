import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { authApi, type LoginDto } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'Login failed'
  }
  return 'Login failed'
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (dto: LoginDto) => authApi.login(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
