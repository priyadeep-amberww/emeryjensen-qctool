/** Vendor-neutral structured logging for the QC Template. */

export const LOG_CATEGORIES = [
  'SYSTEM',
  'SETTINGS',
  'CREDENTIALS',
  'SCRAPING',
  'AI',
  'QC',
  'LOGIN',
  'LOGIN SUCCESSFUL',
  'SESSION EXPIRED',
  'ERROR',
  'WARNING',
  'INFO',
] as const

export type LogCategory = (typeof LOG_CATEGORIES)[number]

/** Extensible: known categories plus any future tool-specific labels. */
export type LogCategoryInput = LogCategory | (string & {})

export type QcLogEntry = {
  id: string
  /** Epoch milliseconds — wall-clock time of the event. */
  at: number
  category: LogCategoryInput
  message: string
  /** Optional secondary detail (IDs, counts, etc.). */
  detail?: string
  batchLabel?: string
}

export type AppendLogInput = {
  category: LogCategoryInput
  message: string
  detail?: string
  batchLabel?: string
  /** Override timestamp (tests / replay). Defaults to Date.now(). */
  at?: number
}
