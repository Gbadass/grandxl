import { create } from 'zustand'

/**
 * Global promise-based confirm/alert.
 *
 * Usage anywhere — components or plain functions — no hooks required:
 *
 *   import { confirm } from '../lib/confirm'
 *
 *   const ok = await confirm({
 *     title: 'Sign out?',
 *     message: 'You\'ll need to sign in again to place orders.',
 *     confirmLabel: 'Sign Out',
 *     variant: 'destructive',
 *   })
 *   if (ok) { ... }
 *
 * Alert mode (single button, info-only):
 *
 *   await confirm({ title: 'Job taken', message: '...', mode: 'alert' })
 */

export type ConfirmVariant = 'default' | 'destructive' | 'success'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /** "alert" hides the cancel button and resolves true on dismiss. */
  mode?: 'confirm' | 'alert'
  icon?: 'warning' | 'info' | 'check' | 'phone' | 'trash' | null
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions | null
  resolve: ((value: boolean) => void) | null
  show: (opts: ConfirmOptions) => Promise<boolean>
  resolveWith: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  show(opts) {
    // If something is already open, resolve it false first so we never lose a promise.
    const prev = get().resolve
    if (prev) prev(false)

    return new Promise<boolean>((resolve) => {
      set({ open: true, options: opts, resolve })
    })
  },
  resolveWith(value) {
    const { resolve } = get()
    if (resolve) resolve(value)
    set({ open: false, resolve: null })
    // Keep `options` around briefly so the exit animation can read it; cleared on next show.
  },
}))

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(opts)
}
