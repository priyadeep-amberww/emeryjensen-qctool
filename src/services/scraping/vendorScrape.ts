import { templateScrapeFailureFromRow } from '../../errorEngine/templateScrapeMarkers'
import { ScrapeOperationError } from '../../errorEngine/types'
import type { AppSettings } from '../../types/settings'
import type { InputRow } from '../../utils/inputParse'
import { executeVendorScrapeStep } from '../errorEngine/errorEngineApi'
import { ensureVendorLoginBeforeScrape, type VendorLoginGateRefs } from '../vendorSession/vendorLoginGate'
import type { AppendLogInput } from '../../types/log'

export type VendorScrapeContext = {
  rowIndex: number
  headless: boolean
  batchLabel?: string
  settings: Pick<AppSettings, 'vendorLoginRequired' | 'reuseVendorSession' | 'headlessScraping'>
  loginGateRefs: VendorLoginGateRefs
  appendLog: (input: AppendLogInput) => void
}

/**
 * Vendor-neutral scrape entry point. Real vendor tools replace the IPC / in-process
 * implementation; this wrapper normalizes failures into `ScrapeOperationError`.
 */
export async function scrapeProductForRow(
  row: InputRow,
  context: VendorScrapeContext,
): Promise<void> {
  await ensureVendorLoginBeforeScrape(
    context.settings,
    context.loginGateRefs,
    context.appendLog,
    context.batchLabel,
  )

  const templateFailure = templateScrapeFailureFromRow(row)
  if (templateFailure) {
    throw templateFailure
  }

  const result = await executeVendorScrapeStep({
    row,
    rowIndex: context.rowIndex,
    headless: context.headless,
    batchLabel: context.batchLabel,
    vendorLoginRequired: context.settings.vendorLoginRequired,
  })

  if (!result.ok) {
    throw new ScrapeOperationError({
      kind: result.kind,
      message: result.error,
      sku: String(row.part_sku ?? row.sku ?? ''),
      retryable: true,
    })
  }
}
