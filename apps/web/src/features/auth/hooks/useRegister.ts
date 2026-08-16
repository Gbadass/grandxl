import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { authApi, type RegisterDto } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'Registration failed'
  }
  return 'Registration failed'
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (dto: RegisterDto) => authApi.register(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
      notify.success('Account created! Welcome to GrandXL.')
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
