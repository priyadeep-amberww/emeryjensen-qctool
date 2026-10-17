import type { QcResult } from '../types/qc'

export type ExportVerdictFilter = 'all' | 'pass' | 'fail' | 'manual' | 'exceptions'

export type ExportVerdictCounts = {
  all: number
  pass: number
  fail: number
  manual: number
  exceptions: number
}

export function emptyExportVerdictCounts(): ExportVerdictCounts {
  return { all: 0, pass: 0, fail: 0, manual: 0, exceptions: 0 }
}

export function bumpExportVerdictCounts(
  counts: ExportVerdictCounts,
  result: QcResult,
): ExportVerdictCounts {
  const next = { ...counts, all: counts.all + 1 }
  if (result.captureStatus) {
    if (isQcExportException(result)) next.exceptions += 1
    return next
  }
  if (result.verdict === 'PASS') next.pass += 1
  else if (result.verdict === 'FAIL') next.fail += 1
  else if (result.verdict) next.manual += 1
  if (isQcExportException(result)) next.exceptions += 1
  return next
}

const MISSING_MARKERS = new Set(['—', '-', 'n/a', 'na', 'null', 'undefined'])

function isMissingValue(value: string | undefined): boolean {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return true
  return MISSING_MARKERS.has(trimmed.toLowerCase())
}

/** Rows with missing scrape/compare fields (data gaps), distinct from verdict-based manual review. */
export function isQcExportException(result: QcResult): boolean {
  if (result.identity.some((field) => isMissingValue(field.value))) return true
  return result.comparisons.some(
    (field) => isMissingValue(field.sourceValue) || isMissingValue(field.targetValue),
  )
}

export function countExportVerdicts(results: QcResult[]): ExportVerdictCounts {
  let pass = 0
  let fail = 0
  let manual = 0
  let exceptions = 0
  for (const row of results) {
    if (row.captureStatus) {
      if (isQcExportException(row)) exceptions++
      continue
    }
    if (row.verdict === 'PASS') pass++
    else if (row.verdict === 'FAIL') fail++
    else if (row.verdict === 'MANUAL_REVIEW') manual++
    if (isQcExportException(row)) exceptions++
  }
  return { all: results.length, pass, fail, manual, exceptions }
}

export function filterQcResultsForExport(
  results: QcResult[],
  filter: ExportVerdictFilter,
): QcResult[] {
  if (filter === 'all') return results
  if (filter === 'pass') return results.filter((r) => r.verdict === 'PASS')
  if (filter === 'fail') return results.filter((r) => r.verdict === 'FAIL')
  if (filter === 'manual') return results.filter((r) => r.verdict === 'MANUAL_REVIEW')
  return results.filter((r) => isQcExportException(r))
}

