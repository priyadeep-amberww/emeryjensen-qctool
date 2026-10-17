import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  appendQcBatchResult,
  getQcBatchSession,
  pauseQcBatch,
  pingInternet,
  resumeQcBatch,
  startQcBatch,
  stopQcBatch,
} from '../services/qcApi'
import { ensureVendorLoginBeforeScrape } from '../services/vendorSession/vendorLoginGate'
import { ScrapeOperationError } from '../errorEngine/types'
import { VENDOR_INTEGRATION_ID } from '../config/vendorIntegration'
import { completeBatchInProcess } from '../services/qc/qcEngineService'
import { processQcRowForBatch, QcControlInterrupt } from '../services/qc/qcRowApi'
import { useAiUsage } from './AiUsageContext'
import { useErrorEngine } from './ErrorEngineContext'
import { useLogs } from './LogsContext'
import { useBrandAliases } from './BrandAliasContext'
import { useSettings } from './SettingsContext'
import { emitQcErrorNotification } from '../services/qc/qcEngineNotifications'
import type { QcProcessStatus, QcResult } from '../types/qc'
import type { InputRow } from '../utils/inputParse'
import { buildFailedQcResult, captureStatusLabel } from '../services/qc/listingQcMapper'
import {
  countExportVerdicts,
  emptyExportVerdictCounts,
  type ExportVerdictCounts,
} from '../utils/qcExport'
import {
  clearExportLockSnapshot,
  lockExportSnapshot,
  readExportDraft,
} from '../utils/customExportDraft'

export type StartQcPayload = {
  sessionId: string
}

type BatchRunContextValue = {
  total: number
  completedCount: number
  exportVerdictCounts: ExportVerdictCounts
  passCount: number
  aiInputTokens: number
  aiOutputTokens: number
  status: QcProcessStatus
  running: boolean
  startedAt: number | null
  currentBatchLabel: string | null
  sessionId: string | null
  hasBatchQueue: boolean
  canStartFromLive: boolean
  start: (payload: StartQcPayload) => Promise<void>
  startValidated: () => Promise<void>
  rememberValidatedSession: (sessionId: string | null) => void
  pause: () => Promise<boolean>
  resume: () => Promise<boolean>
  stop: () => Promise<boolean>
  reset: () => Promise<void>
}

type BatchResultsContextValue = {
  resultsRevision: number
  getCompletedResults: () => readonly QcResult[]
}

const BatchRunContext = createContext<BatchRunContextValue | null>(null)
const BatchResultsContext = createContext<BatchResultsContextValue | null>(null)

const TICK_MS = 650

function formatVerdictLabel(verdict: string): string {
  return verdict.replace(/_/g, ' ')
}

export function BatchDemoProvider({ children }: { children: ReactNode }) {
  const { appendLog } = useLogs()
  const { recordUsage } = useAiUsage()
  const { settings } = useSettings()
  const { aliasPairs } = useBrandAliases()
  const completedRef = useRef<QcResult[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [exportVerdictCounts, setExportVerdictCounts] = useState(emptyExportVerdictCounts)
  const [passCount, setPassCount] = useState(0)
  const [aiInputTokens, setAiInputTokens] = useState(0)
  const [aiOutputTokens, setAiOutputTokens] = useState(0)
  const [resultsRevision, setResultsRevision] = useState(0)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<QcProcessStatus>('idle')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [currentBatchLabel, setCurrentBatchLabel] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [validatedSessionId, setValidatedSessionId] = useState<string | null>(null)
  const [networkHold, setNetworkHold] = useState(false)
  const runSeqRef = useRef(0)
  const batchLabelRef = useRef<string | null>(null)
  const prevStatusRef = useRef<QcProcessStatus>(status)
  const sessionReadyRef = useRef(false)
  const queueRef = useRef<InputRow[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const statusRef = useRef<QcProcessStatus>(status)
  statusRef.current = status
  const processingRowRef = useRef(false)
  const rowFlightRef = useRef(0)
  const controlEpochRef = useRef(0)
  const validatedSessionIdRef = useRef<string | null>(null)
  const networkHoldRef = useRef(false)
  validatedSessionIdRef.current = validatedSessionId
  networkHoldRef.current = networkHold
  const passCountRef = useRef(0)
  const { handleScrapeFailure, isRecovering, resetRecoveryUi } = useErrorEngine()
  const running = status === 'running'

  const getCompletedResults = useCallback(() => completedRef.current, [])

  const clearLocalResults = useCallback(() => {
    completedRef.current = []
    setCompletedCount(0)
    setExportVerdictCounts(emptyExportVerdictCounts())
    setPassCount(0)
    passCountRef.current = 0
    setAiInputTokens(0)
    setAiOutputTokens(0)
    setResultsRevision(0)
  }, [])

  const rememberValidatedSession = useCallback((next: string | null) => {
    validatedSessionIdRef.current = next
    setValidatedSessionId(next)
  }, [])

  const syncVerdictCounts = useCallback((rows: readonly QcResult[]) => {
    const counts = countExportVerdicts(rows)
    setExportVerdictCounts(counts)
    passCountRef.current = counts.pass
    setPassCount(counts.pass)
  }, [])

  const reset = useCallback(async () => {
    controlEpochRef.current += 1
    networkHoldRef.current = false
    setNetworkHold(false)
    const sessionId = sessionIdRef.current
    if (
      sessionId &&
      (statusRef.current === 'running' || statusRef.current === 'paused')
    ) {
      await stopQcBatch({ sessionId })
    }
    clearLocalResults()
    queueRef.current = []
    sessionIdRef.current = null
    setSessionId(null)
    setTotal(0)
    prevStatusRef.current = 'idle'
    setStatus('idle')
    setStartedAt(null)
    setCurrentBatchLabel(null)
    batchLabelRef.current = null
    sessionReadyRef.current = false
    rememberValidatedSession(null)
    resetRecoveryUi()
    clearExportLockSnapshot()
    appendLog({ category: 'SYSTEM', message: 'QC workspace reset' })
  }, [appendLog, clearLocalResults, rememberValidatedSession, resetRecoveryUi])

  const start = useCallback(
    async (payload: StartQcPayload) => {
      const session = await getQcBatchSession(payload.sessionId)
      if (!session.ok) {
        appendLog({
          category: 'ERROR',
          message: 'Cannot start QC',
          detail: session.error,
        })
        return
      }
      if (session.rows.length === 0) {
        appendLog({
          category: 'ERROR',
          message: 'Cannot start QC',
          detail: 'Validated batch has no rows',
        })
        return
      }
      if (session.state !== 'running') {
        appendLog({
          category: 'ERROR',
          message: 'Cannot start QC',
          detail:
            session.state === 'validated'
              ? 'Press Start QC on Upload after validation.'
              : `Batch session is ${session.state}. Validate and start a new batch.`,
        })
        return
      }

      queueRef.current = session.rows
      sessionIdRef.current = payload.sessionId
      setSessionId(payload.sessionId)
      setTotal(session.rows.length)

      runSeqRef.current += 1
      const label = `QC-${String(runSeqRef.current).padStart(3, '0')}`
      batchLabelRef.current = label
      setCurrentBatchLabel(label)
      clearLocalResults()
      setStartedAt(Date.now())
      prevStatusRef.current = 'running'
      setStatus('running')
      rememberValidatedSession(null)
      lockExportSnapshot(readExportDraft())

      try {
        await ensureVendorLoginBeforeScrape(
          settings,
          { sessionReady: sessionReadyRef },
          appendLog,
          label,
        )
      } catch (error) {
        const detail =
          error instanceof ScrapeOperationError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Vendor login failed'
        await stopQcBatch({ sessionId: payload.sessionId }).catch(() => {})
        queueRef.current = []
        sessionIdRef.current = null
        setSessionId(null)
        setTotal(0)
        prevStatusRef.current = 'idle'
        setStatus('idle')
        setStartedAt(null)
        setCurrentBatchLabel(null)
        batchLabelRef.current = null
        sessionReadyRef.current = false
        clearExportLockSnapshot()
        appendLog({
          category: 'ERROR',
          message: 'Cannot start QC — vendor login failed',
          detail,
          batchLabel: label,
        })
        return
      }

      appendLog({
        category: 'SYSTEM',
        message: 'QC process started',
        detail: `0/${session.rows.length}`,
        batchLabel: label,
      })
      appendLog({
        category: 'QC',
        message: 'Batch queue ready',
        detail: `${session.rows.length} SKUs from validated upload`,
        batchLabel: label,
      })
    },
    [appendLog, clearLocalResults, rememberValidatedSession, settings],
  )

  const startValidated = useCallback(async () => {
    const idleLike =
      statusRef.current === 'idle' ||
      statusRef.current === 'done' ||
      statusRef.current === 'stopped'
    if (!idleLike) return
    const sessionId = validatedSessionIdRef.current
    if (!sessionId) {
      appendLog({
        category: 'ERROR',
        message: 'Cannot start QC',
        detail: 'Validate a file on Upload first.',
      })
      return
    }
    const started = await startQcBatch({ sessionId })
    if (!started.ok) {
      appendLog({
        category: 'ERROR',
        message: 'Cannot start QC',
        detail: started.error,
      })
      return
    }
    await start({ sessionId })
  }, [appendLog, start])

  const pause = useCallback(async () => {
    if (statusRef.current !== 'running') return false
    controlEpochRef.current += 1
    const sessionId = sessionIdRef.current
    if (sessionId) {
      const result = await pauseQcBatch({ sessionId })
      if (!result.ok) {
        appendLog({
          category: 'ERROR',
          message: 'Could not pause QC',
          detail: result.error,
          batchLabel: batchLabelRef.current ?? undefined,
        })
        return false
      }
    }
    setStatus('paused')
    return true
  }, [appendLog])

  const resume = useCallback(async () => {
    if (statusRef.current !== 'paused') return false
    const epoch = controlEpochRef.current
    const label = batchLabelRef.current ?? undefined
    sessionReadyRef.current = false
    try {
      await ensureVendorLoginBeforeScrape(
        settings,
        { sessionReady: sessionReadyRef },
        appendLog,
        label,
      )
    } catch (error) {
      const detail =
        error instanceof ScrapeOperationError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Vendor login failed'
      appendLog({
        category: 'ERROR',
        message: 'Cannot resume QC — vendor login failed',
        detail,
        batchLabel: label,
      })
      return false
    }
    if (controlEpochRef.current !== epoch || statusRef.current !== 'paused') return false

    const sessionId = sessionIdRef.current
    if (sessionId) {
      const result = await resumeQcBatch({ sessionId })
      if (!result.ok) {
        appendLog({
          category: 'ERROR',
          message: 'Could not resume QC',
          detail: result.error,
          batchLabel: label,
        })
        return false
      }
    }
    if (controlEpochRef.current !== epoch || statusRef.current !== 'paused') return false
    networkHoldRef.current = false
    setNetworkHold(false)
    setStatus('running')
    return true
  }, [appendLog, settings])

  const stop = useCallback(async () => {
    if (statusRef.current !== 'running' && statusRef.current !== 'paused') return false
    controlEpochRef.current += 1
    networkHoldRef.current = false
    setNetworkHold(false)
    const sessionId = sessionIdRef.current
    if (sessionId) {
      const result = await stopQcBatch({ sessionId })
      if (!result.ok) {
        appendLog({
          category: 'ERROR',
          message: 'Could not stop QC',
          detail: result.error,
          batchLabel: batchLabelRef.current ?? undefined,
        })
        return false
      }
    }
    setStatus('stopped')
    return true
  }, [appendLog])

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev === status) return
    const label = batchLabelRef.current ?? undefined
    if (prev === 'running' && status === 'paused') {
      appendLog({ category: 'SYSTEM', message: 'QC process paused', batchLabel: label })
    } else if (prev === 'paused' && status === 'running') {
      appendLog({ category: 'SYSTEM', message: 'QC process resumed', batchLabel: label })
    } else if ((prev === 'running' || prev === 'paused') && status === 'stopped') {
      appendLog({ category: 'SYSTEM', message: 'QC process stopped', batchLabel: label })
      clearExportLockSnapshot()
    } else if (status === 'done' && prev === 'running') {
      appendLog({
        category: 'QC',
        message: 'QC process completed',
        detail: `${total}/${total}`,
        batchLabel: label,
      })
      appendLog({
        category: 'SYSTEM',
        message: 'Batch finished successfully',
        batchLabel: label,
      })
      if (sessionIdRef.current) {
        completeBatchInProcess(sessionIdRef.current)
      }
      clearExportLockSnapshot()
    } else if (status === 'done' && prev === 'paused') {
      clearExportLockSnapshot()
    }
  }, [status, appendLog, total])

  useEffect(() => {
    if (status !== 'running') return
    if (total <= 0) return
    if (isRecovering || processingRowRef.current) return
    if (completedCount >= total) {
      setStatus('done')
      return
    }

    let cancelled = false
    const flight = ++rowFlightRef.current
    processingRowRef.current = true
    const epochAtStart = controlEpochRef.current

    const processRow = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, TICK_MS))
      if (
        cancelled ||
        statusRef.current !== 'running' ||
        controlEpochRef.current !== epochAtStart
      ) {
        return
      }

      const rowIndex = completedCount
      const row = queueRef.current[rowIndex]
      if (!row) return

      const label = batchLabelRef.current ?? undefined
      const sessionId = sessionIdRef.current

      try {
        const headless =
          VENDOR_INTEGRATION_ID === 'emry' ? false : settings.headlessScraping
        const result = await processQcRowForBatch(row, {
          rowIndex,
          headless,
          batchLabel: label,
          settings,
          brandAliases: aliasPairs,
          loginGateRefs: { sessionReady: sessionReadyRef },
          appendLog,
          sessionId: sessionId ?? undefined,
        })
        if (
          cancelled ||
          statusRef.current !== 'running' ||
          controlEpochRef.current !== epochAtStart
        ) {
          return
        }
        const nextCount = rowIndex + 1
        const sku =
          result.identity.find((f) => f.key === 'sku')?.value ??
          result.identity[0]?.value ??
          result.id

        const inTok = result.inputTokens ?? 0
        const outTok = result.outputTokens ?? 0
        if (inTok > 0 || outTok > 0) {
          recordUsage(inTok, outTok)
          setAiInputTokens((prev) => prev + inTok)
          setAiOutputTokens((prev) => prev + outTok)
        }

        completedRef.current.push(result)
        if (sessionId) {
          const stored = await appendQcBatchResult(sessionId, result)
          if (!stored.ok) {
            appendLog({
              category: 'ERROR',
              message: 'Could not persist QC result',
              detail: stored.error,
              batchLabel: label,
            })
          }
        }

        syncVerdictCounts(completedRef.current)
        setCompletedCount(nextCount)
        setResultsRevision((rev) => rev + 1)

        if (result.captureStatus) {
          const upc = result.identity.find((f) => f.key === 'upc')?.value ?? '—'
          appendLog({
            category: 'SCRAPING',
            message: `Row ${rowIndex + 1}: EJD search for UPC ${upc}`,
            detail: `PART SKU ${sku}`,
            batchLabel: label,
          })
          for (const line of result.scrapeLog ?? []) {
            appendLog({
              category: line.toLowerCase().includes('failed') ? 'ERROR' : 'SCRAPING',
              message: line,
              detail: sku,
              batchLabel: label,
            })
          }
          appendLog({
            category: result.captureStatus === 'sp_api_failed' ? 'ERROR' : 'SCRAPING',
            message: `Capture pair saved — ${captureStatusLabel(result.captureStatus)}`,
            detail: `${nextCount}/${total} · ${sku}`,
            batchLabel: label,
          })
          if (result.verdict) {
            appendLog({
              category:
                result.verdict === 'FAIL' ? 'ERROR' : result.verdict === 'MANUAL_REVIEW' ? 'WARNING' : 'QC',
              message: `${result.verdict} — ${sku}`,
              detail: `${nextCount}/${total}`,
              batchLabel: label,
            })
          }
        } else {
          appendLog({
            category: 'SCRAPING',
            message: `Vendor listing scraped for ${sku}`,
            detail: settings.headlessScraping
              ? result.id
              : `${result.id} · visible browser`,
            batchLabel: label,
          })
          appendLog({
            category: 'SCRAPING',
            message: `Amazon SP-API listing loaded`,
            detail: result.identity.find((f) => f.key === 'listing_id')?.value ?? result.id,
            batchLabel: label,
          })
          appendLog({
            category: 'AI',
            message: `Model comparison finished for ${sku}`,
            detail: `${result.inputTokens ?? 0} in / ${result.outputTokens ?? 0} out`,
            batchLabel: label,
          })

          const verdictLabel = result.verdict ? formatVerdictLabel(result.verdict) : ''
          if (result.verdict === 'FAIL') {
            emitQcErrorNotification({
              batchLabel: label ?? null,
              completedCount: nextCount,
              passCount: passCountRef.current,
              total,
              status: statusRef.current,
              startedAt: startedAt,
              error_message: `QC FAIL — ${sku} (${verdictLabel})`,
            })
            appendLog({
              category: 'ERROR',
              message: `QC FAIL — ${sku}`,
              detail: `${nextCount}/${total} · ${verdictLabel}`,
              batchLabel: label,
            })
          } else if (result.verdict === 'MANUAL_REVIEW') {
            appendLog({
              category: 'WARNING',
              message: `Manual review required — ${sku}`,
              detail: `${nextCount}/${total} · ${verdictLabel}`,
              batchLabel: label,
            })
          } else if (result.verdict === 'PASS') {
            appendLog({
              category: 'QC',
              message: `PASS — ${sku}`,
              detail: `${nextCount}/${total}`,
              batchLabel: label,
            })
          }
        }
      } catch (error) {
        if (error instanceof QcControlInterrupt) return
        if (
          cancelled ||
          statusRef.current !== 'running' ||
          controlEpochRef.current !== epochAtStart
        ) {
          return
        }
        if (error instanceof ScrapeOperationError && error.kind === 'parse') {
          const result = buildFailedQcResult(row, error.message)
          const nextCount = rowIndex + 1
          const sku = result.identity.find((f) => f.key === 'sku')?.value ?? result.id
          completedRef.current.push(result)
          if (sessionId) {
            const stored = await appendQcBatchResult(sessionId, result)
            if (!stored.ok) {
              appendLog({
                category: 'ERROR',
                message: 'Could not persist QC result',
                detail: stored.error,
                batchLabel: label,
              })
            }
          }
          syncVerdictCounts(completedRef.current)
          setCompletedCount(nextCount)
          setResultsRevision((rev) => rev + 1)
          appendLog({
            category: 'ERROR',
            message: `FAIL — ${sku}`,
            detail: `${nextCount}/${total} · ${error.message}`,
            batchLabel: label,
          })
          return
        }

        sessionReadyRef.current = false
        if (error instanceof ScrapeOperationError && error.kind === 'network') {
          const online = await pingInternet().catch(() => false)
          if (!online && statusRef.current === 'running') {
            networkHoldRef.current = true
            setNetworkHold(true)
            appendLog({
              category: 'WARNING',
              message: 'Internet dropped during this SKU — QC paused',
              detail: 'The same SKU will run again after the connection is confirmed.',
              batchLabel: label,
            })
            await pause()
            return
          }
        }
        if (!settings.errorEngineEnabled) {
          const detail = error instanceof Error ? error.message : 'Scrape failed'
          emitQcErrorNotification({
            batchLabel: label ?? null,
            completedCount: completedCount,
            passCount: passCountRef.current,
            total,
            status: statusRef.current,
            startedAt,
            error_message: detail,
          })
          appendLog({
            category: 'ERROR',
            message: 'Scrape failed (Error Engine disabled)',
            detail,
            batchLabel: label,
          })
          await pause()
          return
        }
        const recovered = await handleScrapeFailure(error, {
          pause,
          resume,
          batchLabel: label,
        })
        if (recovered) {
          sessionReadyRef.current = true
        }
      } finally {
        if (rowFlightRef.current === flight) processingRowRef.current = false
      }
    }

    void processRow()

    return () => {
      cancelled = true
    }
  }, [
    status,
    completedCount,
    total,
    startedAt,
    isRecovering,
    appendLog,
    recordUsage,
    settings,
    aliasPairs,
    handleScrapeFailure,
    pause,
    resume,
    syncVerdictCounts,
  ])

  useEffect(() => {
    if (status !== 'running' && !networkHold) return
    let cancelled = false

    const watch = async () => {
      if (cancelled) return
      let online = false
      try {
        online = await pingInternet()
      } catch {
        online = false
      }
      if (cancelled) return

      if (!online && statusRef.current === 'running') {
        networkHoldRef.current = true
        setNetworkHold(true)
        appendLog({
          category: 'WARNING',
          message: 'Internet unreachable — QC paused',
          detail: 'Pinging every minute. The run resumes from the last unfinished SKU after the link is confirmed.',
          batchLabel: batchLabelRef.current ?? undefined,
        })
        await pause()
        return
      }

      if (online && networkHoldRef.current && statusRef.current === 'paused') {
        let confirmed = false
        try {
          confirmed = await pingInternet()
        } catch {
          confirmed = false
        }
        if (
          cancelled ||
          !confirmed ||
          !networkHoldRef.current ||
          statusRef.current !== 'paused'
        ) {
          return
        }
        appendLog({
          category: 'SYSTEM',
          message: 'Internet restored — logging back into the portal',
          detail: 'Resuming from the last unfinished SKU',
          batchLabel: batchLabelRef.current ?? undefined,
        })
        const resumed = await resume()
        if (resumed) {
          networkHoldRef.current = false
          setNetworkHold(false)
        }
      }
    }

    void watch()
    const intervalMs = networkHold ? 60_000 : 15_000
    const id = window.setInterval(() => void watch(), intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [status, networkHold, appendLog, pause, resume])

  const runValue = useMemo(
    () => ({
      total,
      completedCount,
      exportVerdictCounts,
      passCount,
      aiInputTokens,
      aiOutputTokens,
      status,
      running,
      startedAt,
      currentBatchLabel,
      sessionId,
      hasBatchQueue: total > 0,
      canStartFromLive:
        (status === 'idle' || status === 'done' || status === 'stopped') &&
        Boolean(validatedSessionId),
      start,
      startValidated,
      rememberValidatedSession,
      pause,
      resume,
      stop,
      reset,
    }),
    [
      total,
      completedCount,
      exportVerdictCounts,
      passCount,
      aiInputTokens,
      aiOutputTokens,
      status,
      running,
      startedAt,
      currentBatchLabel,
      sessionId,
      validatedSessionId,
      start,
      startValidated,
      rememberValidatedSession,
      pause,
      resume,
      stop,
      reset,
    ],
  )

  const resultsValue = useMemo(
    () => ({
      resultsRevision,
      getCompletedResults,
    }),
    [resultsRevision, getCompletedResults],
  )

  return (
    <BatchRunContext.Provider value={runValue}>
      <BatchResultsContext.Provider value={resultsValue}>{children}</BatchResultsContext.Provider>
    </BatchRunContext.Provider>
  )
}

export function useBatchRun() {
  const ctx = useContext(BatchRunContext)
  if (!ctx) throw new Error('useBatchRun must be used within BatchDemoProvider')
  return ctx
}

export function useBatchResults() {
  const ctx = useContext(BatchResultsContext)
  if (!ctx) throw new Error('useBatchResults must be used within BatchDemoProvider')
  return ctx
}

/** Combined batch state (prefer `useBatchRun` on Export to avoid result-table churn). */
export function useBatchDemo() {
  const run = useBatchRun()
  const { getCompletedResults, resultsRevision } = useBatchResults()
  return {
    ...run,
    resultsRevision,
    getCompletedResults,
    completed: getCompletedResults(),
    completedCount: run.completedCount,
  }
}
