import { ipcMain } from 'electron'
import {
  appendBatchResult,
  createBatchSession,
  getBatchResults,
  getBatchSession,
  markBatchPaused,
  markBatchResumed,
  markBatchRunning,
  markBatchStopped,
  newSessionId,
} from './qcBatchStore.mjs'
import { QC_VALIDATE_PREVIEW_ROWS, runUploadValidation } from './qcUploadValidation.mjs'
import { processQcRow } from './qc/processQcRow.mjs'

export function registerQcIpc() {
  ipcMain.handle('qc:validateUpload', async (_event, request) => {
    if (!request || typeof request !== 'object') {
      return { ok: false, errors: ['Invalid validation request'] }
    }
    const result = runUploadValidation(request)
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors,
        duplicateAsinBlocked: result.duplicateAsinBlocked === true,
      }
    }
    const sessionId = newSessionId()
    createBatchSession(sessionId, request.fieldIds ?? [], result.rows)
    const rowCount = result.rows.length
    const previewRows = result.rows.slice(0, QC_VALIDATE_PREVIEW_ROWS)
    return {
      ok: true,
      sessionId,
      rowCount,
      previewRows,
      skippedDuplicateAsinRows: result.skippedDuplicateAsinRows,
    }
  })

  ipcMain.handle('qc:startBatch', async (_event, payload) => {
    const sessionId = payload?.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing validation session.' }
    }
    const session = getBatchSession(sessionId)
    if (!session) {
      return { ok: false, error: 'Validation session expired. Run Validate again.' }
    }
    if (session.state !== 'validated') {
      return { ok: false, error: 'This batch was already started or completed.' }
    }
    if (session.rows.length === 0) {
      return { ok: false, error: 'No rows in validated batch.' }
    }
    const running = markBatchRunning(sessionId)
    if (!running) {
      return { ok: false, error: 'Unable to start QC for this session.' }
    }
    return { ok: true, sessionId, total: running.rows.length }
  })

  ipcMain.handle('qc:pauseBatch', async (_event, payload) => {
    const sessionId = payload?.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing validation session.' }
    }
    const session = markBatchPaused(sessionId)
    if (!session) {
      return { ok: false, error: 'QC can only be paused while it is running.' }
    }
    return { ok: true, sessionId, state: session.state }
  })

  ipcMain.handle('qc:resumeBatch', async (_event, payload) => {
    const sessionId = payload?.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing validation session.' }
    }
    const session = markBatchResumed(sessionId)
    if (!session) {
      return { ok: false, error: 'QC can only be resumed while it is paused.' }
    }
    return { ok: true, sessionId, state: session.state }
  })

  ipcMain.handle('qc:stopBatch', async (_event, payload) => {
    const sessionId = payload?.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing validation session.' }
    }
    const session = markBatchStopped(sessionId)
    if (!session) {
      return { ok: false, error: 'QC can only be stopped while running or paused.' }
    }
    return { ok: true, sessionId, state: session.state }
  })

  ipcMain.handle('qc:processRow', async (_event, payload) => processQcRow(payload))

  ipcMain.handle('qc:appendBatchResult', async (_event, payload) => {
    const sessionId = payload?.sessionId
    const result = payload?.result
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing session id.' }
    }
    if (!result || typeof result !== 'object') {
      return { ok: false, error: 'Missing QC result.' }
    }
    const ok = appendBatchResult(sessionId, result)
    if (!ok) {
      return { ok: false, error: 'Validation session not found.' }
    }
    return { ok: true, count: getBatchResults(sessionId).length }
  })

  ipcMain.handle('qc:getSession', async (_event, payload) => {
    const sessionId = payload?.sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return { ok: false, error: 'Missing session id.' }
    }
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
  })
}
