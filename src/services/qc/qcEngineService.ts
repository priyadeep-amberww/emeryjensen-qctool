import { buildSandboxQcResult } from '../../data/sandboxQc'
import type { AppSettings } from '../../types/settings'
import {
  QC_VALIDATE_PREVIEW_ROWS,
  type QcBatchControlRequest,
  type QcBatchControlResponse,
  type QcBatchSessionResponse,
  type QcStartBatchRequest,
  type QcStartBatchResponse,
  type QcValidateRequest,
  type QcValidateResponse,
} from '../../types/qcUpload'
import type { BrandAliasPair } from '../../types/brandAlias'
import type { InputRow } from '../../utils/inputParse'
import type { QcResult } from '../../types/qc'
import { applyQcThresholdsToResult } from '../../utils/qcThresholdComparison'
import {
  createBatchSession,
  getBatchSession,
  markBatchDone,
  markBatchPaused,
  markBatchResumed,
  markBatchRunning,
  markBatchStopped,
} from './qcBatchSession'
import { runUploadValidation } from './qcUploadValidation'
import { sandboxQcResultToQcResult } from './sandboxToQcResult'

/** QC Engine event bus (renderer integrations such as Bitrix24 subscribe here). */
export {
  buildQcEventPayload,
  emitQcEngineEvent,
  subscribeQcEngineEvents,
  type QcEngineEventName,
  type QcEngineEventPayload,
} from './qcEngineEventBus'

function newSessionId(): string {
  return `qc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function validateUploadInProcess(request: QcValidateRequest): QcValidateResponse {
  const result = runUploadValidation(request)
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors,
      duplicateAsinBlocked: result.duplicateAsinBlocked === true,
    }
  }
  const sessionId = newSessionId()
  createBatchSession(
    sessionId,
    request.fieldIds,
    result.rows,
  )
  const rowCount = result.rows.length
  return {
    ok: true,
    sessionId,
    rowCount,
    previewRows: result.rows.slice(0, QC_VALIDATE_PREVIEW_ROWS),
    skippedDuplicateAsinRows: result.skippedDuplicateAsinRows,
  }
}

export function startBatchInProcess(request: QcStartBatchRequest): QcStartBatchResponse {
  const session = getBatchSession(request.sessionId)
  if (!session) {
    return { ok: false, error: 'Validation session expired. Run Validate again.' }
  }
  if (session.state !== 'validated') {
    return { ok: false, error: 'This batch was already started or completed.' }
  }
  if (session.rows.length === 0) {
    return { ok: false, error: 'No rows in validated batch.' }
  }
  const running = markBatchRunning(request.sessionId)
  if (!running) {
    return { ok: false, error: 'Unable to start QC for this session.' }
  }
  return { ok: true, sessionId: request.sessionId, total: running.rows.length }
}

export function pauseBatchInProcess(request: QcBatchControlRequest): QcBatchControlResponse {
  const session = markBatchPaused(request.sessionId)
  if (!session) {
    return { ok: false, error: 'QC can only be paused while it is running.' }
  }
  return { ok: true, sessionId: session.sessionId, state: session.state }
}

export function resumeBatchInProcess(request: QcBatchControlRequest): QcBatchControlResponse {
  const session = markBatchResumed(request.sessionId)
  if (!session) {
    return { ok: false, error: 'QC can only be resumed while it is paused.' }
  }
  return { ok: true, sessionId: session.sessionId, state: session.state }
}

export function stopBatchInProcess(request: QcBatchControlRequest): QcBatchControlResponse {
  const session = markBatchStopped(request.sessionId)
  if (!session) {
    return { ok: false, error: 'QC can only be stopped while running or paused.' }
  }
  return { ok: true, sessionId: session.sessionId, state: session.state }
}

export function getBatchSessionInProcess(sessionId: string): QcBatchSessionResponse {
  const session = getBatchSession(sessionId)
  if (!session) {
    return { ok: false, error: 'Validation session not found.' }
  }
  return {
    ok: true,
    sessionId: session.sessionId,
    rows: session.rows,
    fieldIds: session.fieldIds,
    state: session.state,
  }
}

export function completeBatchInProcess(sessionId: string): void {
  markBatchDone(sessionId)
}

export function buildQcResultForRow(
  row: InputRow,
  settings: Pick<AppSettings, keyof AppSettings>,
  brandAliases: readonly BrandAliasPair[],
): QcResult {
  const sandbox = buildSandboxQcResult(row, settings, { brandAliases })
  let result = sandboxQcResultToQcResult(sandbox)
  result = applyQcThresholdsToResult(result, settings, { brandAliases })
  return result
}

/** Apply validated rows from an external store (Electron main). */
export function registerValidatedBatch(
  sessionId: string,
  fieldIds: string[],
  rows: InputRow[],
): void {
  createBatchSession(sessionId, fieldIds, rows)
}
