import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ToastNotification } from './ToastNotification'
import {
  TOAST_DEFAULT_DURATION_MS,
  type ToastInput,
  type ToastItem,
  type ToastType,
} from './types'

type ShowToast = {
  (message: string, type?: ToastType): void
  (input: ToastInput): void
}

type ToastContextValue = {
  showToast: ShowToast
  dismissToast: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const EXIT_MS = 160

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const [exiting, setExiting] = useState(false)
  const idRef = useRef(0)
  const hideTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const activeKeyRef = useRef<string | null>(null)
  const toastRef = useRef<ToastItem | null>(null)
  const exitingRef = useRef(false)

  toastRef.current = toast
  exitingRef.current = exiting

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [])

  const finishDismiss = useCallback(() => {
    clearTimers()
    setExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      setToast(null)
      setExiting(false)
      activeKeyRef.current = null
      exitTimerRef.current = null
    }, EXIT_MS)
  }, [clearTimers])

  const scheduleAutoHide = useCallback(
    (duration: number) => {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null
        finishDismiss()
      }, duration)
    },
    [finishDismiss],
  )

  const showToast = useCallback<ShowToast>(
    (messageOrInput: string | ToastInput, typeArg?: ToastType) => {
      const input: ToastInput =
        typeof messageOrInput === 'string'
          ? { message: messageOrInput, type: typeArg }
          : messageOrInput

      const message = input.message.trim()
      if (!message) return

      const type: ToastType = input.type ?? 'info'
      const duration = input.duration ?? TOAST_DEFAULT_DURATION_MS
      const dedupeKey = `${type}:${message}`

      // Same visible toast → refresh timer only (no duplicate stack).
      if (toastRef.current && !exitingRef.current && activeKeyRef.current === dedupeKey) {
        scheduleAutoHide(duration)
        return
      }

      clearTimers()
      setExiting(false)
      idRef.current += 1
      activeKeyRef.current = dedupeKey
      setToast({
        id: idRef.current,
        message,
        type,
        duration,
      })
      scheduleAutoHide(duration)
    },
    [clearTimers, scheduleAutoHide],
  )

  const dismissToast = useCallback(() => {
    if (!toastRef.current || exitingRef.current) return
    finishDismiss()
  }, [finishDismiss])

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-3 right-3 z-[1400] flex flex-col items-end gap-2"
      >
        {toast && (
          <ToastNotification toast={toast} exiting={exiting} onDismiss={dismissToast} />
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
