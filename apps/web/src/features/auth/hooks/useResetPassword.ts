import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { authApi, type ResetPasswordDto } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'Password reset failed'
  }
  return 'Password reset failed'
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (dto: ResetPasswordDto) => authApi.resetPassword(dto),
    onSuccess: () => {
      notify.success('Password reset successfully. Please log in.')
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
