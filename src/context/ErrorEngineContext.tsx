import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { runErrorEngineRecovery } from '../errorEngine/recoveryOrchestrator'
import { ScrapeOperationError, type ErrorEnginePhase } from '../errorEngine/types'
import { cancelVendorSession, reloginVendorSession } from '../services/errorEngine/errorEngineApi'
import { useLogs } from './LogsContext'
import { useSettings } from './SettingsContext'

type BatchRecoveryControls = {
  pause: () => Promise<void>
  resume: () => Promise<void>
  batchLabel?: string
}

type ErrorEngineContextValue = {
  phase: ErrorEnginePhase
  statusMessage: string
  isRecovering: boolean
  handleScrapeFailure: (error: unknown, controls: BatchRecoveryControls) => Promise<boolean>
  resetRecoveryUi: () => void
}

const ErrorEngineContext = createContext<ErrorEngineContextValue | null>(null)

export function ErrorEngineProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { appendLog } = useLogs()
  const [phase, setPhase] = useState<ErrorEnginePhase>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const recoveryInFlightRef = useRef(false)

  const onPhase = useCallback((next: ErrorEnginePhase, message: string) => {
    setPhase(next)
    setStatusMessage(message)
  }, [])

  const resetRecoveryUi = useCallback(() => {
    setPhase('idle')
    setStatusMessage('')
  }, [])

  const handleScrapeFailure = useCallback(
    async (error: unknown, controls: BatchRecoveryControls): Promise<boolean> => {
      if (!settings.errorEngineEnabled) return false
      if (recoveryInFlightRef.current) return false

      const scrapeError =
        error instanceof ScrapeOperationError
          ? error
          : new ScrapeOperationError({
              kind: 'unknown',
              message: error instanceof Error ? error.message : 'Unknown scrape error',
              retryable: true,
            })

      if (!scrapeError.retryable) {
        appendLog({
          category: 'ERROR',
          message: 'Non-retryable scrape error',
          detail: scrapeError.message,
          batchLabel: controls.batchLabel,
        })
        return false
      }

      recoveryInFlightRef.current = true
      try {
        await controls.pause()

        if (!settings.vendorLoginRequired) {
          onPhase(
            'paused',
            'Scrape error — QC paused (relogin skipped; vendor login not required)',
          )
          appendLog({
            category: 'INFO',
            message: 'Error Engine: relogin skipped',
            detail: 'Vendor login not required for this tool',
            batchLabel: controls.batchLabel,
          })
          appendLog({
            category: 'ERROR',
            message: 'Error Engine: scrape failure',
            detail: scrapeError.message,
            batchLabel: controls.batchLabel,
          })
          return false
        }

        const result = await runErrorEngineRecovery(
          scrapeError,
          settings,
          {
            cancelSession: cancelVendorSession,
            relogin: (attempt, vendorLoginRequired) =>
              reloginVendorSession(attempt, vendorLoginRequired),
          },
          {
            onPhase,
            appendLog,
            batchLabel: controls.batchLabel,
          },
        )

        if (result.ok) {
          await controls.resume()
          onPhase('idle', '')
          return true
        }

        return false
      } finally {
        recoveryInFlightRef.current = false
      }
    },
    [appendLog, onPhase, settings],
  )

  const isRecovering = phase !== 'idle' && phase !== 'recovered' && phase !== 'recovery_failed'

  const value = useMemo(
    () => ({
      phase,
      statusMessage,
      isRecovering,
      handleScrapeFailure,
      resetRecoveryUi,
    }),
    [phase, statusMessage, isRecovering, handleScrapeFailure, resetRecoveryUi],
  )

  return <ErrorEngineContext.Provider value={value}>{children}</ErrorEngineContext.Provider>
}

export function useErrorEngine() {
  const ctx = useContext(ErrorEngineContext)
  if (!ctx) throw new Error('useErrorEngine must be used within ErrorEngineProvider')
  return ctx
}
