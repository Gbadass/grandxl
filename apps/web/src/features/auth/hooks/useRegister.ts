import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (dto: RegisterDto) => authApi.register(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
      notify.success(t('register.accountCreated'))
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
