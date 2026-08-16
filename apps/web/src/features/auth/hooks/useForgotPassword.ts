import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { authApi } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'Request failed'
  }
  return 'Request failed'
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword({ email }),
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
