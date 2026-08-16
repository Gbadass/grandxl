import toast from 'react-hot-toast'

// Wrapper around react-hot-toast so swapping libraries later = change one file
export const notify = {
  success: (message: string) => toast.success(message),
  error:   (message: string) => toast.error(message),
  info:    (message: string) => toast(message, { icon: 'ℹ️' }),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string)     => toast.dismiss(id),
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) => toast.promise(promise, messages),
}
