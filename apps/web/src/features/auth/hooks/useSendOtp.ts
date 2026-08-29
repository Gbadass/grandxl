import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { notify } from '../../../utils/toast'

export function useSendOtp() {
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (phone: string) => authApi.sendOtp({ phone }),
    onSuccess: () => {
      notify.success(t('otp.sent'))
    },
    onError: (err: unknown) => {
      notify.error(parseApiError(err, 'Failed to send OTP'))
    },
  })
}
