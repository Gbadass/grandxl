import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'Failed to send OTP'
  }
  return 'Failed to send OTP'
}

export function useSendOtp() {
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (phone: string) => authApi.sendOtp({ phone }),
    onSuccess: () => {
      notify.success(t('otp.sent'))
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
