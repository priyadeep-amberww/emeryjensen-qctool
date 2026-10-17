import type { AppendLogInput } from '../types/log'
import type { ErrorEngineSettings } from '../types/settings'
import { exponentialBackoffMs, sleep } from './backoff'
import type {
  ErrorEnginePhase,
  ErrorEngineRecoveryResult,
  ScrapeOperationError,
  VendorReloginResult,
} from './types'

export type VendorSessionPort = {
  cancelSession: () => Promise<void>
  relogin: (attempt: number, vendorLoginRequired: boolean) => Promise<VendorReloginResult>
}

export type RecoveryOrchestratorCallbacks = {
  onPhase: (phase: ErrorEnginePhase, statusMessage: string) => void
  appendLog: (input: AppendLogInput) => void
  batchLabel?: string
}

export async function runErrorEngineRecovery(
  error: ScrapeOperationError,
  settings: ErrorEngineSettings & { vendorLoginRequired: boolean },
  sessionPort: VendorSessionPort,
  callbacks: RecoveryOrchestratorCallbacks,
): Promise<ErrorEngineRecoveryResult> {
  if (!settings.vendorLoginRequired) {
    return { ok: false, attemptsUsed: 0, error: 'Relogin disabled (vendor login not required)' }
  }
  const { onPhase, appendLog, batchLabel } = callbacks
  const maxAttempts = settings.errorEngineMaxRetries

  onPhase('error_detected', `Error detected — ${error.message}`)
  appendLog({
    category: 'ERROR',
    message: 'Error Engine: scrape failure detected',
    detail: `${error.kind}: ${error.message}`,
    batchLabel,
  })

  onPhase('paused', 'QC batch auto-paused')
  appendLog({
    category: 'SYSTEM',
    message: 'Error Engine: QC batch auto-paused',
    detail: error.sku ? `SKU ${error.sku}` : undefined,
    batchLabel,
  })

  onPhase('cancelling_session', 'Cancelling vendor login session…')
  appendLog({
    category: 'SESSION EXPIRED',
    message: 'Error Engine: vendor session cancelled',
    detail: 'Preparing automatic relogin',
    batchLabel,
  })

  try {
    await sessionPort.cancelSession()
  } catch (cancelErr) {
    const msg = cancelErr instanceof Error ? cancelErr.message : 'Session cancel failed'
    appendLog({
      category: 'WARNING',
      message: 'Error Engine: session cancel warning',
      detail: msg,
      batchLabel,
    })
  }

  let lastError = 'Relogin failed'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const waitMs =
      attempt > 1
        ? exponentialBackoffMs(attempt - 1, settings.errorEngineBackoffBaseMs)
        : 0

    if (waitMs > 0) {
      onPhase(
        'relogging',
        `Attempting relogin (${attempt}/${maxAttempts}) after ${Math.round(waitMs / 1000)}s backoff…`,
      )
      appendLog({
        category: 'LOGIN',
        message: 'Error Engine: waiting before relogin retry',
        detail: `Attempt ${attempt}/${maxAttempts} · ${waitMs}ms`,
        batchLabel,
      })
      await sleep(waitMs)
    } else {
      onPhase('relogging', `Attempting relogin (${attempt}/${maxAttempts})…`)
    }

    appendLog({
      category: 'LOGIN',
      message: 'Error Engine: automatic relogin attempt',
      detail: `${attempt}/${maxAttempts}`,
      batchLabel,
    })

    const relogin = await sessionPort.relogin(attempt, settings.vendorLoginRequired)
    if (relogin.ok) {
      onPhase('resuming', 'Relogin successful — resuming QC batch…')
      appendLog({
        category: 'LOGIN SUCCESSFUL',
        message: 'Error Engine: relogin succeeded',
        detail: `Attempts used: ${attempt}`,
        batchLabel,
      })
      onPhase('recovered', 'Recovery complete — QC resumed')
      appendLog({
        category: 'SYSTEM',
        message: 'Error Engine: recovery complete',
        detail: 'QC batch resumed from last position',
        batchLabel,
      })
      return { ok: true, attemptsUsed: attempt }
    }

    lastError = relogin.error
    appendLog({
      category: 'ERROR',
      message: 'Error Engine: relogin attempt failed',
      detail: `${attempt}/${maxAttempts} · ${relogin.error}`,
      batchLabel,
    })
  }

  onPhase(
    'recovery_failed',
    `Recovery failed after ${maxAttempts} relogin attempt(s). QC remains paused.`,
  )
  appendLog({
    category: 'ERROR',
    message: 'Error Engine: recovery exhausted',
    detail: lastError,
    batchLabel,
  })

  return { ok: false, attemptsUsed: maxAttempts, error: lastError }
}
