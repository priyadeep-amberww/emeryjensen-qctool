import type { BrandAliasPair } from '../types/brandAlias'
import type { QcResult } from '../types/qc'
import type { QcThresholdSettings } from '../types/settings'
import { QC_CORE_COMPARISONS, type QcCoreComparisonKey } from '../constants/qcCoreComparisons'
import { resolveQcImageUrls } from './qcImages'
import { comparisonOutcomeForKey, type QcCompareOutcome } from './qcThresholdComparison'

export type QcCoreVerdict = 'YES' | 'NO'

export type QcCoreSummaryRow = {
  key: QcCoreComparisonKey
  label: string
  amazonValue: string
  vendorValue: string
  outcome: QcCompareOutcome
  verdict: QcCoreVerdict
}

export type QcCoreSummary = {
  rows: QcCoreSummaryRow[]
  /** Core-six binary pass (all MATCH). */
  finalVerdict: 'PASS' | 'FAIL'
}

function comparisonValues(
  result: QcResult,
  key: QcCoreComparisonKey,
): { vendorValue: string; amazonValue: string; field?: QcResult['comparisons'][number] } {
  const field = result.comparisons.find((c) => c.key === key)
  if (key === 'image') {
    const { sourceUrl, targetUrl } = resolveQcImageUrls(result)
    return {
      vendorValue: field?.sourceValue?.trim() || sourceUrl?.trim() || '—',
      amazonValue: field?.targetValue?.trim() || targetUrl?.trim() || '—',
      field,
    }
  }
  return {
    vendorValue: field?.sourceValue?.trim() || '—',
    amazonValue: field?.targetValue?.trim() || '—',
    field,
  }
}

function toCoreVerdict(outcome: QcCompareOutcome): QcCoreVerdict {
  return outcome === 'MATCH' ? 'YES' : 'NO'
}

/**
 * Core-six QC summary for the SKU viewer SUMMARY tab.
 * Per-row YES/NO uses stored capture outcomes when present.
 */
export function buildQcCoreSummary(
  result: QcResult,
  thresholds: QcThresholdSettings,
  options?: { brandAliases?: readonly BrandAliasPair[] },
): QcCoreSummary {
  const rows: QcCoreSummaryRow[] = QC_CORE_COMPARISONS.map(({ key, label }) => {
    const { vendorValue, amazonValue, field } = comparisonValues(result, key)
    const outcome = comparisonOutcomeForKey(
      key,
      vendorValue,
      amazonValue,
      thresholds,
      options,
      field,
    )
    return {
      key,
      label,
      amazonValue,
      vendorValue,
      outcome,
      verdict: toCoreVerdict(outcome),
    }
  })

  const finalVerdict: 'PASS' | 'FAIL' = rows.every((r) => r.verdict === 'YES') ? 'PASS' : 'FAIL'
  return { rows, finalVerdict }
}

export function qcResultIdentityValue(result: QcResult, ...keys: string[]): string {
  for (const key of keys) {
    const field = result.identity.find((f) => f.key === key)
    const v = field?.value?.trim()
    if (v && v !== '—') return v
  }
  const first = result.identity[0]?.value?.trim()
  return first && first !== '—' ? first : '—'
}
