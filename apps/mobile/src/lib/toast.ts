import { create } from 'zustand'

/**
 * Lightweight global toast — non-blocking, auto-dismissing notifications.
 *
 *   import { toast } from '../lib/toast'
 *
 *   toast.success('Order placed')
 *   toast.error('Could not connect to server')
 *   toast.info('New rider nearby')
 *   toast.warning('Wallet low')
 *
 * Or with options:
 *
 *   toast.success('Address saved', { duration: 5000 })
 *   toast.error('Upload failed', { action: { label: 'Retry', onPress: retry } })
 *
 * For confirms or destructive prompts that need a user response, use confirm() instead.
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface ToastOptions {
  /** ms — default 3500. Set to 0 to keep until manually dismissed. */
  duration?: number
  action?: ToastAction
}

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  duration: number
  action?: ToastAction
}

interface ToastState {
  toasts: ToastItem[]
  show: (variant: ToastVariant, message: string, opts?: ToastOptions) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show(variant, message, opts) {
    const id = nextId++
    const item: ToastItem = {
      id,
      message,
      variant,
      duration: opts?.duration ?? 3500,
      action: opts?.action,
    }
    set((s) => ({ toasts: [...s.toasts, item] }))
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

function call(variant: ToastVariant, message: string, opts?: ToastOptions): number {
  return useToastStore.getState().show(variant, message, opts)
}

export const toast = Object.assign(
  (message: string, opts?: ToastOptions) => call('info', message, opts),
  {
    success: (message: string, opts?: ToastOptions) => call('success', message, opts),
    error:   (message: string, opts?: ToastOptions) => call('error',   message, opts),
    info:    (message: string, opts?: ToastOptions) => call('info',    message, opts),
    warning: (message: string, opts?: ToastOptions) => call('warning', message, opts),
    dismiss: (id: number) => useToastStore.getState().dismiss(id),
  },
)
