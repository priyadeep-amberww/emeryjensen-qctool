import { ensureEmryBrowserPage } from './browserSession.mjs'
import { assertEmrySessionAlive } from './sessionWatch.mjs'

/**
 * Open WhItemDetail for an EJD SKU and return spec HTML.
 * @param {string} ejdSku
 * @param {(line: string) => void} logLine
 */
export async function fetchItemDetailHtml(ejdSku, logLine) {
  const sku = String(ejdSku ?? '').replace(/\D/g, '')
  if (!/^(?:[0-9]{5}|[0-9]{7})$/.test(sku)) {
    return { ok: false, error: 'Invalid EJD SKU for item detail.' }
  }

  const page = await ensureEmryBrowserPage()
  const alive = await assertEmrySessionAlive(page)
  if (!alive.ok) {
    return { ok: false, kind: 'authentication', error: alive.reason }
  }

  const url = `https://ejdportal.com/WhItemDetail/ItemDetail/View?StockNo=${sku}&IsFromSearch=1`
  logLine(`Opening item detail ${url}`)

  try {
    const popup = await page.context().newPage()
    await popup.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 })
    const html = await popup.locator('body').innerHTML({ timeout: 10_000 })
    await popup.close().catch(() => {})
    logLine(`Item detail loaded (${html.length} bytes)`)
    return { ok: true, html: html.slice(0, 80_000) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Item detail failed'
    logLine(`Item detail unavailable: ${message}`)
    return { ok: false, error: message }
  }
}
