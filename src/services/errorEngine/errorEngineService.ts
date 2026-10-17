import type { InputRow } from '../../utils/inputParse'
import type { ScrapeErrorKind, VendorReloginResult, VendorScrapeResult } from '../../errorEngine/types'

const SCRAPE_STEP_MS = 40

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function cancelVendorSessionInProcess(): Promise<void> {
  await delay(25)
}

export async function reloginVendorInProcess(attempt: number): Promise<VendorReloginResult> {
  await delay(120 + attempt * 40)
  return { ok: true }
}

export async function executeVendorScrapeInProcess(payload: {
  row: InputRow
  rowIndex: number
  headless: boolean
  vendorLoginRequired: boolean
}): Promise<VendorScrapeResult> {
  await delay(SCRAPE_STEP_MS)
  const sku = String(payload.row.part_sku ?? payload.row.sku ?? '')
  if (sku.toUpperCase().includes('SCRAPE_FAIL')) {
    return { ok: false, kind: 'network', error: `Could not reach vendor listing for ${sku}` }
  }
  return { ok: true }
}

export function normalizeScrapeErrorKind(value: unknown): ScrapeErrorKind {
  const allowed: ScrapeErrorKind[] = [
    'network',
    'timeout',
    'authentication',
    'parse',
    'blocked',
    'unknown',
  ]
  if (typeof value === 'string' && allowed.includes(value as ScrapeErrorKind)) {
    return value as ScrapeErrorKind
  }
  return 'unknown'
}
