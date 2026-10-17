import type { InputRow } from '../utils/inputParse'
import { ScrapeOperationError, type ScrapeErrorKind } from './types'

/**
 * Optional template hook: rows whose SKU contains `SCRAPE_FAIL` trigger a scrape error
 * so the Error Engine can be validated without vendor-specific wiring.
 */
export function templateScrapeFailureFromRow(row: InputRow): ScrapeOperationError | null {
  const sku = String(row.part_sku ?? row.sku ?? '').trim()
  if (!sku) return null
  const upper = sku.toUpperCase()
  if (!upper.includes('SCRAPE_FAIL')) return null

  let kind: ScrapeErrorKind = 'network'
  if (upper.includes('AUTH')) kind = 'authentication'
  else if (upper.includes('TIMEOUT')) kind = 'timeout'

  return new ScrapeOperationError({
    kind,
    message: `Scrape failed for ${sku} (${kind})`,
    sku,
    retryable: true,
  })
}
