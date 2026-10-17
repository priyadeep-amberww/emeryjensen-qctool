import type { CaptureRowPayload, ListingQcPayload } from '../../types/listingExtract'
import type { CaptureStatus, QcResult } from '../../types/qc'
import type { SandboxQcResult } from '../../data/sandboxQc'
import { tokenCostUsd } from '../../utils/aiPricing'
import { sandboxQcResultToQcResult } from './sandboxToQcResult'
import type { InputRow } from '../../utils/inputParse'

/** Map backend listing QC payload into live `QcResult`. */
export function listingQcPayloadToSandboxQcResult(payload: ListingQcPayload): SandboxQcResult {
  const costUsd = tokenCostUsd(payload.inputTokens, payload.outputTokens)
  return {
    ...payload,
    fetched: payload.asinExtract,
    costUsd,
    estimatedX1000Usd: costUsd * 1000,
  }
}

export function listingQcPayloadToQcResult(payload: ListingQcPayload): QcResult {
  return sandboxQcResultToQcResult(listingQcPayloadToSandboxQcResult(payload))
}

export function captureStatusLabel(status: CaptureStatus): string {
  switch (status) {
    case 'captured':
      return 'Captured'
    case 'not_on_portal':
      return 'Not on portal'
    case 'bad_parse':
      return 'Bad parse'
    case 'sp_api_failed':
      return 'SP-API failed'
    default:
      return status
  }
}

export function capturePayloadToQcResult(payload: CaptureRowPayload): QcResult {
  const sku =
    payload.identity.find((f) => f.key === 'sku')?.value ??
    payload.identity[0]?.value ??
    'SKU'
  const imageCmp = payload.comparisons?.find((c) => c.key === 'image')
  return {
    id: sku,
    identity: payload.identity,
    captureStatus: payload.captureStatus,
    verdict: payload.verdict,
    comparisons: payload.comparisons ?? [],
    sourceColumnLabel: 'Vendor (EJD)',
    targetColumnLabel: 'Amazon (SP-API)',
    sourceImageUrl:
      imageCmp?.sourceValue && imageCmp.sourceValue !== '—' ? imageCmp.sourceValue : undefined,
    targetImageUrl:
      imageCmp?.targetValue && imageCmp.targetValue !== '—' ? imageCmp.targetValue : undefined,
    sourceRawExtract: payload.vendorExtract,
    targetRawExtract: payload.amazonCatalogJson,
    scrapeLog: payload.scrapeLog,
    inputTokens: payload.inputTokens,
    outputTokens: payload.outputTokens,
    amazonPackReport: payload.amazonPackReport,
  }
}

function pickRow(row: InputRow, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key]?.trim()
    if (v) return v
  }
  return ''
}

/** Minimal QC row when Amazon fetch or compare fails (batch does not stall). */
export function buildFailedQcResult(row: InputRow, errorMessage: string): QcResult {
  const sku = pickRow(row, 'part_sku', 'sku') || 'SKU-UNKNOWN'
  const asin = pickRow(row, 'asin') || '—'
  return {
    id: sku,
    identity: [
      { key: 'sku', label: 'SKU', value: sku },
      { key: 'listing_id', label: 'ASIN', value: asin },
    ],
    verdict: 'MANUAL_REVIEW',
    comparisons: [
      {
        key: 'error',
        label: 'QC error',
        sourceValue: '—',
        targetValue: errorMessage.slice(0, 200),
      },
    ],
    sourceColumnLabel: 'Vendor',
    targetColumnLabel: 'Amazon',
  }
}
