import type { InputRow } from '../../utils/inputParse'
import type { VendorReloginResult, VendorScrapeResult } from '../../errorEngine/types'
import {
  cancelVendorSessionInProcess,
  executeVendorScrapeInProcess,
  normalizeScrapeErrorKind,
  reloginVendorInProcess,
} from './errorEngineService'

function bridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.errorEngine : undefined
}

export async function cancelVendorSession(): Promise<void> {
  const api = bridge()
  if (api?.cancelSession) {
    await api.cancelSession()
    return
  }
  await cancelVendorSessionInProcess()
}

export async function reloginVendorSession(
  attempt: number,
  vendorLoginRequired = true,
): Promise<VendorReloginResult> {
  if (!vendorLoginRequired) {
    return { ok: false, error: 'Relogin disabled (vendor login not required)' }
  }
  const api = bridge()
  if (api?.relogin) {
    return api.relogin({ attempt, vendorLoginRequired })
  }
  return reloginVendorInProcess(attempt)
}

export async function executeVendorScrapeStep(payload: {
  row: InputRow
  rowIndex: number
  headless: boolean
  batchLabel?: string
  vendorLoginRequired: boolean
}): Promise<VendorScrapeResult> {
  const api = bridge()
  if (api?.executeScrape) {
    const result = await api.executeScrape(payload)
    if (result.ok) return result
    return {
      ok: false,
      kind: normalizeScrapeErrorKind(result.kind),
      error: result.error,
    }
  }
  return executeVendorScrapeInProcess(payload)
}
