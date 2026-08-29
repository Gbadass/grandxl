import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi, type VerifyOtpDto } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

export function useVerifyOtp() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (dto: VerifyOtpDto) => authApi.verifyOtp(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
      notify.success(t('otp.verified'))
    },
    onError: (err: unknown) => {
      notify.error(parseApiError(err, 'OTP verification failed'))
    },
  })
}
