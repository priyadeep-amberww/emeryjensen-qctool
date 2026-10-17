import { buildQcExportXlsxBuffer, formatEmryQcExportFileName } from './export/qcStandardExport.mjs'

const MISSING_MARKERS = new Set(['—', '-', 'n/a', 'na', 'null', 'undefined'])

function isMissingValue(value) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return true
  return MISSING_MARKERS.has(trimmed.toLowerCase())
}

export function isQcExportException(result) {
  if (result.identity?.some((field) => isMissingValue(field.value))) return true
  return (result.comparisons ?? []).some(
    (field) => isMissingValue(field.sourceValue) || isMissingValue(field.targetValue),
  )
}

export function filterQcResultsForExport(results, filter) {
  if (filter === 'all') return results
  if (filter === 'pass') return results.filter((r) => r.verdict === 'PASS')
  if (filter === 'fail') return results.filter((r) => r.verdict === 'FAIL')
  if (filter === 'manual') return results.filter((r) => r.verdict === 'MANUAL_REVIEW')
  return results.filter((r) => isQcExportException(r))
}

export function buildExportFileName({ scope, rowCount }) {
  return formatEmryQcExportFileName(scope, rowCount)
}

export async function runQcExportPipeline(request, resolveResults) {
  const scope = request?.scope
  const filter = request?.filter ?? 'all'
  const batchTotal = typeof request?.batchTotal === 'number' ? request.batchTotal : 0
  const sessionId = typeof request?.sessionId === 'string' ? request.sessionId : ''
  let results = []
  if (sessionId && typeof resolveResults === 'function') {
    results = resolveResults(sessionId) ?? []
  } else if (Array.isArray(request?.results)) {
    results = request.results
  }

  if (scope !== 'partial' && scope !== 'full') {
    return { ok: false, error: 'Invalid export scope.' }
  }
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

  const fileName = buildExportFileName({
    scope,
    rowCount: filteredRows.length,
  })

  const buffer = await buildQcExportXlsxBuffer(filteredRows)

  return {
    ok: true,
    fileName,
    content: Buffer.from(buffer),
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rowCount: filteredRows.length,
    format: 'xlsx',
    scope,
  }
}
