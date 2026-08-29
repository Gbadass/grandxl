import { useMutation } from '@tanstack/react-query'
import { authApi } from '@grandxl/api-client'
import { parseApiError } from '@grandxl/utils'
import { notify } from '../../../utils/toast'

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword({ email }),
    onError: (err: unknown) => {
      notify.error(parseApiError(err, 'Request failed'))
    },
  })
}
