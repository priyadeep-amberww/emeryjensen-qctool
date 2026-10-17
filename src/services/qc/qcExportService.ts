import type { QcExportRequest, QcExportResponse } from '../../types/qcExport'
import { filterQcResultsForExport } from '../../utils/qcExport'
import { downloadQcExportXlsx, formatEmryQcExportFileName } from '../../utils/qcStandardExport'
import { getBatchResults } from './qcBatchSession'

/** In-process export (web / dev) — same validation and file content as the Electron main process. */
function resolveExportResults(request: QcExportRequest): import('../../types/qc').QcResult[] {
  if (request.sessionId) {
    return getBatchResults(request.sessionId)
  }
  return Array.isArray(request.results) ? request.results : []
}

export async function exportQcBatchInProcess(request: QcExportRequest): Promise<QcExportResponse> {
  const { scope, filter, batchTotal } = request
  const results = resolveExportResults(request)

  if (scope === 'partial' && results.length === 0) {
    return { ok: false, error: 'No finished QC rows to export yet.' }
  }
  if (scope === 'full') {
    if (batchTotal <= 0) {
      return { ok: false, error: 'Batch total is missing. Run QC from Upload first.' }
    }
    if (results.length < batchTotal) {
      return {
        ok: false,
        error: `Full export unlocks when the batch finishes (${results.length}/${batchTotal} complete).`,
      }
    }
  }

  const filteredRows = filterQcResultsForExport(results, filter)
  if (filteredRows.length === 0) {
    return { ok: false, error: 'No rows match the current verdict filter.' }
  }

  const fileName = formatEmryQcExportFileName(scope, filteredRows.length)
  await downloadQcExportXlsx(fileName, filteredRows)

  return {
    ok: true,
    fileName,
    rowCount: filteredRows.length,
    format: 'xlsx',
    scope,
  }
}
