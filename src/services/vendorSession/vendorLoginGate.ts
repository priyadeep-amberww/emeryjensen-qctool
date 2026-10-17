import type { AppendLogInput } from '../../types/log'
import type { AppSettings } from '../../types/settings'
import { ScrapeOperationError } from '../../errorEngine/types'
import { performVendorLogin } from './vendorSessionApi'
import { fetchVendorSessionStatus } from './vendorSessionStatusApi'
import { VENDOR_INTEGRATION_ID } from '../../config/vendorIntegration'

type AppendLog = (input: AppendLogInput) => void

export type VendorLoginGateRefs = {
  sessionReady: { current: boolean }
}

/**
 * Vendor-neutral login gate — called before scraping when `vendorLoginRequired` is ON.
 * Skips entirely when OFF (GLID-style direct scrape).
 */
export async function ensureVendorLoginBeforeScrape(
  settings: Pick<AppSettings, 'vendorLoginRequired' | 'reuseVendorSession' | 'headlessScraping'>,
  refs: VendorLoginGateRefs,
  appendLog: AppendLog,
  batchLabel?: string,
): Promise<void> {
  if (!settings.vendorLoginRequired) {
    return
  }

  if (settings.reuseVendorSession) {
    const remote = await fetchVendorSessionStatus()
    if (remote.armed) {
      refs.sessionReady.current = true
      return
    }
  }

  const shouldLogin = !settings.reuseVendorSession || !refs.sessionReady.current
  if (!shouldLogin) {
    return
  }

  appendLog({
    category: 'LOGIN',
    message: 'Session authentication started',
    detail: settings.reuseVendorSession ? 'reuse session enabled' : 'fresh login',
    batchLabel,
  })

  const headedOnly = VENDOR_INTEGRATION_ID === 'emry' ? false : settings.headlessScraping
  const login = await performVendorLogin({
    vendorLoginRequired: settings.vendorLoginRequired,
    reuseSession: settings.reuseVendorSession,
    headless: headedOnly,
    batchLabel,
  })

  if (!login.ok) {
    throw new ScrapeOperationError({
      kind: 'authentication',
      message: login.error,
      retryable: settings.vendorLoginRequired,
    })
  }

  if (settings.reuseVendorSession) {
    refs.sessionReady.current = true
  }

  appendLog({
    category: 'LOGIN SUCCESSFUL',
    message: 'Session authenticated',
    batchLabel,
  })
}
