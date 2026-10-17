import type { SandboxQcResult } from '../../data/sandboxQc'
import type { QcResult } from '../../types/qc'

/** Map sandbox QC engine output into the live-results `QcResult` shape. */
export function sandboxQcResultToQcResult(result: SandboxQcResult): QcResult {
  const id =
    result.identity.find((f) => f.key === 'sku')?.value ??
    result.identity.find((f) => f.key === 'listing_id')?.value ??
    result.identity[0]?.value ??
    'SKU'

  return {
    id,
    identity: result.identity,
    verdict: result.verdict,
    comparisons: result.comparisons.map(({ key, label, sourceValue, targetValue }) => ({
      key,
      label,
      sourceValue,
      targetValue,
    })),
    sourceColumnLabel: 'Vendor',
    targetColumnLabel: 'Amazon',
    sourceImageUrl: result.vendorExtract.imageUrl,
    targetImageUrl: result.asinExtract.imageUrl,
    sourceRawExtract: result.vendorExtract,
    targetRawExtract: result.asinExtract,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  }
}
