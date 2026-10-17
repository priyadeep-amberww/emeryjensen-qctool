import type { QcResult } from '../types/qc'
import type {
  QcBatchControlRequest,
  QcBatchControlResponse,
  QcBatchSessionResponse,
  QcStartBatchRequest,
  QcStartBatchResponse,
  QcValidateRequest,
  QcValidateResponse,
} from '../types/qcUpload'
import {
  appendBatchResult as appendBatchResultInProcess,
  getBatchResults,
} from './qc/qcBatchSession'
import {
  getBatchSessionInProcess,
  pauseBatchInProcess,
  resumeBatchInProcess,
  startBatchInProcess,
  stopBatchInProcess,
  validateUploadInProcess,
} from './qc/qcEngineService'

function qcBridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.qc : undefined
}

export async function validateUpload(request: QcValidateRequest): Promise<QcValidateResponse> {
  const bridge = qcBridge()
  if (bridge?.validateUpload) {
    return bridge.validateUpload(request)
  }
  return validateUploadInProcess(request)
}

export async function startQcBatch(request: QcStartBatchRequest): Promise<QcStartBatchResponse> {
  const bridge = qcBridge()
  if (bridge?.startBatch) {
    return bridge.startBatch(request)
  }
  return startBatchInProcess(request)
}

export async function pauseQcBatch(request: QcBatchControlRequest): Promise<QcBatchControlResponse> {
  const bridge = qcBridge()
  if (bridge?.pauseBatch) {
    return bridge.pauseBatch(request)
  }
  return pauseBatchInProcess(request)
}

export async function resumeQcBatch(request: QcBatchControlRequest): Promise<QcBatchControlResponse> {
  const bridge = qcBridge()
  if (bridge?.resumeBatch) {
    return bridge.resumeBatch(request)
  }
  return resumeBatchInProcess(request)
}

export async function stopQcBatch(request: QcBatchControlRequest): Promise<QcBatchControlResponse> {
  const bridge = qcBridge()
  if (bridge?.stopBatch) {
    return bridge.stopBatch(request)
  }
  return stopBatchInProcess(request)
}

export async function pingInternet(): Promise<boolean> {
  const bridge = qcBridge()
  if (bridge?.pingInternet) {
    try {
      const result = await bridge.pingInternet()
      return result.online === true
    } catch {
      return false
    }
  }
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function getQcBatchSession(sessionId: string): Promise<QcBatchSessionResponse> {
  const bridge = qcBridge()
  if (bridge?.getSession) {
    return bridge.getSession({ sessionId })
  }
  return getBatchSessionInProcess(sessionId)
}

export type AppendBatchResultResponse =
  | { ok: true; count: number }
  | { ok: false; error: string }

export async function appendQcBatchResult(
  sessionId: string,
  result: QcResult,
): Promise<AppendBatchResultResponse> {
  const bridge = qcBridge()
  if (bridge?.appendBatchResult) {
    return bridge.appendBatchResult({ sessionId, result })
  }
  const ok = appendBatchResultInProcess(sessionId, result)
  if (!ok) {
    return { ok: false, error: 'Validation session not found.' }
  }
  return { ok: true, count: getBatchResults(sessionId).length }
}
