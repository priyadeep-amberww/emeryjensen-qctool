import { memo, useEffect, useState } from 'react'
import { useAppTheme } from '../../theme'
import type { ToastItem, ToastType } from './types'

type ToastTone = {
  border: string
  bg: string
  text: string
  accent: string
  label: string
}

function toneFor(type: ToastType, isDark: boolean): ToastTone {
  switch (type) {
    case 'success':
      return isDark
        ? {
            border: '#166534',
            bg: '#052e16',
            text: '#bbf7d0',
            accent: '#22c55e',
            label: 'Success',
          }
        : {
            border: '#86efac',
            bg: '#f0fdf4',
            text: '#14532d',
            accent: '#16a34a',
            label: 'Success',
          }
    case 'error':
      return isDark
        ? {
            border: '#991b1b',
            bg: '#450a0a',
            text: '#fecaca',
            accent: '#ef4444',
            label: 'Error',
          }
        : {
            border: '#fca5a5',
            bg: '#fef2f2',
            text: '#7f1d1d',
            accent: '#dc2626',
            label: 'Error',
          }
    case 'warning':
      return isDark
        ? {
            border: '#92400e',
            bg: '#451a03',
            text: '#fde68a',
            accent: '#f59e0b',
            label: 'Warning',
          }
        : {
            border: '#fcd34d',
            bg: '#fffbeb',
            text: '#78350f',
            accent: '#d97706',
            label: 'Warning',
          }
    case 'info':
    default:
      return isDark
        ? {
            border: '#1e3a8a',
            bg: '#0c1a3a',
            text: '#bfdbfe',
            accent: '#3b82f6',
            label: 'Info',
          }
        : {
            border: '#93c5fd',
            bg: '#eff6ff',
            text: '#1e3a8a',
            accent: '#2563eb',
            label: 'Info',
          }
  }
}

type ToastNotificationProps = {
  toast: ToastItem
  exiting: boolean
  onDismiss: () => void
}

/**
 * Compact, typed toast surface used by the global Toast host.
 * Intentionally small — short message only, no dialog chrome.
 */
export const ToastNotification = memo(function ToastNotification({
  toast,
  exiting,
  onDismiss,
}: ToastNotificationProps) {
  const { mode } = useAppTheme()
  const tone = toneFor(toast.type, mode === 'dark')
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(id)
  }, [toast.id])

  const visible = entered && !exiting

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex max-w-[min(360px,calc(100vw-24px))] items-stretch overflow-hidden rounded-[2px] border shadow-lg"
      style={{
        borderColor: tone.border,
        backgroundColor: tone.bg,
        color: tone.text,
        boxShadow: mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 20px rgba(24,24,27,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 160ms ease-out, transform 160ms ease-out',
      }}
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0"
        style={{ backgroundColor: tone.accent }}
      />
      <div className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.04em]"
            style={{ color: tone.accent }}
          >
            {tone.label}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium leading-snug">{toast.message}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border-0 bg-transparent text-[14px] leading-none opacity-70 transition-opacity hover:opacity-100"
          style={{ color: tone.text }}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>
  )
})
