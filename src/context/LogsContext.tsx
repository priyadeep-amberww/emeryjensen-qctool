import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { LOG_CATEGORIES, type AppendLogInput, type QcLogEntry } from '../types/log'

type LogsContextValue = {
  logs: QcLogEntry[]
  /** Known filter categories for the Logs UI. */
  categories: readonly string[]
  appendLog: (input: AppendLogInput) => void
  /** Instant clear — drops the in-memory log buffer only. */
  clearLogs: () => void
}

const LogsContext = createContext<LogsContextValue | null>(null)

let logSeq = 0

function nextLogId(at: number): string {
  logSeq += 1
  return `log-${at}-${logSeq}`
}

/**
 * Global, vendor-neutral log store.
 * Pages only window/filter this array — they never mutate source events.
 */
export function LogsProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<QcLogEntry[]>([])
  const seenCategoriesRef = useRef<Set<string>>(new Set(LOG_CATEGORIES))

  const appendLog = useCallback((input: AppendLogInput) => {
    const message = input.message.trim()
    if (!message) return
    const at = input.at ?? Date.now()
    const category = (input.category || 'INFO').toString().trim().toUpperCase() || 'INFO'
    seenCategoriesRef.current.add(category)
    const entry: QcLogEntry = {
      id: nextLogId(at),
      at,
      category,
      message,
      detail: input.detail?.trim() || undefined,
      batchLabel: input.batchLabel?.trim() || undefined,
    }
    // Functional update keeps append O(1) amortized without copying callers' arrays.
    setLogs((prev) => {
      const next = prev.length > 0 ? prev.slice() : []
      next.push(entry)
      return next
    })
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const categories = useMemo(() => {
    // Stable known order first, then any extra categories discovered at runtime.
    const known = [...LOG_CATEGORIES]
    const extras = [...seenCategoriesRef.current]
      .filter((c) => !known.includes(c as (typeof LOG_CATEGORIES)[number]))
      .sort()
    return [...known, ...extras]
  }, [logs.length])

  const value = useMemo(
    () => ({ logs, categories, appendLog, clearLogs }),
    [logs, categories, appendLog, clearLogs],
  )

  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>
}

export function useLogs(): LogsContextValue {
  const ctx = useContext(LogsContext)
  if (!ctx) throw new Error('useLogs must be used within LogsProvider')
  return ctx
}
