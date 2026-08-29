import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi, type RegisterDto } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

export function getRegisterError(err: unknown): string {
  return parseApiError(err, 'Registration failed')
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
    // No onError toast — registration errors are shown inline in the form
  })
}
