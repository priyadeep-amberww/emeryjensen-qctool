export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type ToastInput = {
  message: string
  type?: ToastType
  /** Auto-dismiss ms. Defaults to 2000. */
  duration?: number
}

export type ToastItem = {
  id: number
  message: string
  type: ToastType
  duration: number
}

export const TOAST_DEFAULT_DURATION_MS = 2000
