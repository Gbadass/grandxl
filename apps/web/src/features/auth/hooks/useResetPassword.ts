import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi, type ResetPasswordDto } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { notify } from '../../../utils/toast'

export function useResetPassword() {
  const { t } = useTranslation('auth')

  return useMutation({
    mutationFn: (dto: ResetPasswordDto) => authApi.resetPassword(dto),
    onSuccess: () => {
      notify.success(t('resetPassword.success'))
    },
    onError: (err: unknown) => {
      notify.error(parseApiError(err, 'Password reset failed'))
    },
  })
}
