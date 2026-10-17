import type { QcResult } from '../types/qc'
import { filterQcResultsForExport, type ExportVerdictFilter } from './qcExport'

function buildLiveOutputSearchHaystack(result: QcResult): string {
  const parts: string[] = [result.id]
  if (result.captureStatus) {
    parts.push(result.captureStatus, result.captureStatus.replace(/_/g, ' '))
  }
  if (result.verdict) {
    parts.push(result.verdict, result.verdict.replace(/_/g, ' '))
  }
  if (result.scrapeLog?.length) {
    parts.push(...result.scrapeLog)
  }
  for (const field of result.identity) {
    parts.push(field.key, field.label, field.value)
  }
  for (const cmp of result.comparisons) {
    parts.push(cmp.key, cmp.label, cmp.sourceValue, cmp.targetValue)
  }
  return parts.join('\n').toLowerCase()
}

/** Match SKU, UPC, model, brand, identity labels, comparison fields, and result id. */
export function matchesLiveOutputSearch(result: QcResult, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  const haystack = buildLiveOutputSearchHaystack(result)
  return tokens.every((token) => haystack.includes(token))
}

export function filterLiveOutputResults(
  results: readonly QcResult[],
  query: string,
  verdictFilter: ExportVerdictFilter,
): QcResult[] {
  const searched = query.trim()
    ? results.filter((r) => matchesLiveOutputSearch(r, query))
    : [...results]
  return filterQcResultsForExport(searched, verdictFilter)
}
