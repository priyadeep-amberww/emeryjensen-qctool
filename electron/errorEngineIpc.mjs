import { ipcMain } from 'electron'
import { templateScrapeFailureFromRow } from './errorEngineScrape.mjs'
import { getVendorScraper } from './vendor/scrapeRegistry.mjs'
import {
  cancelEmryVendorBrowserSession,
  reloginEmryVendorSession,
} from './vendor/emry/vendorSessionManager.mjs'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function registerErrorEngineIpc() {
  ipcMain.handle('errorEngine:cancelSession', async () => cancelEmryVendorBrowserSession())

  ipcMain.handle('errorEngine:relogin', async (_event, payload) => {
    if (payload?.vendorLoginRequired === false) {
      return { ok: false, error: 'Relogin disabled (vendor login not required)' }
    }
    return reloginEmryVendorSession()
  })

  ipcMain.handle('errorEngine:executeScrape', async (_event, payload) => {
    const row = payload?.row
    const rowIndex = typeof payload?.rowIndex === 'number' ? payload.rowIndex : 0
    if (!row || typeof row !== 'object') {
      return { ok: false, kind: 'parse', error: 'Invalid scrape payload' }
    }

    await delay(35)

    const templateErr = templateScrapeFailureFromRow(row)
    if (templateErr) {
      return { ok: false, kind: templateErr.kind, error: templateErr.message }
    }

    const sku = String(row.part_sku ?? row.sku ?? `row-${rowIndex}`)
    if (sku.toUpperCase().includes('SCRAPE_FAIL')) {
      return { ok: false, kind: 'network', error: `Network error while scraping ${sku}` }
    }

    const vendorId = typeof payload?.vendorId === 'string' ? payload.vendorId : 'emry'
    const scraper = getVendorScraper(vendorId)
    const headless = vendorId === 'emry' ? false : payload?.headless !== false
    const result = await scraper({
      row,
      rowIndex,
      headless,
      batchLabel: payload?.batchLabel,
    })
    if (!result.ok) {
      return { ok: false, kind: result.kind, error: result.error }
    }
    return { ok: true, extract: result.extract }
  })
}
