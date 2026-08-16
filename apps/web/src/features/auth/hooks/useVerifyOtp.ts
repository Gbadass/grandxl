import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { authApi, type VerifyOtpDto } from '@grandxl/api-client'
import type { ApiError } from '@grandxl/types'
import { useAuthStore } from '../../../store/auth.store'
import { notify } from '../../../utils/toast'

function getMsg(err: unknown): string {
  if (err instanceof AxiosError) {
    return (err.response?.data as ApiError | undefined)?.message ?? 'OTP verification failed'
  }
  return 'OTP verification failed'
}

export function useVerifyOtp() {
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: (dto: VerifyOtpDto) => authApi.verifyOtp(dto),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data
      setAuth(user, accessToken)
      notify.success('Phone number verified!')
    },
    onError: (err) => {
      notify.error(getMsg(err))
    },
  })
}
