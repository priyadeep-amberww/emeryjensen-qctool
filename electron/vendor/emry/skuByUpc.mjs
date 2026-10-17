import { ensureEmryBrowserPage } from './browserSession.mjs'
import { assertEmrySessionAlive } from './sessionWatch.mjs'

const SKU_RE = /^(?:[0-9]{5}|[0-9]{7})$/

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fast UPC existence check via SkuByUpc.asmx inside the headed session.
 * @param {string} upc12
 * @param {(line: string) => void} logLine
 */
export async function lookupSkuByUpc(upc12, logLine) {
  const upc = String(upc12 ?? '').replace(/\D/g, '')
  if (upc.length !== 12) {
    return { ok: false, kind: 'parse', error: 'UPC must be 12 digits.' }
  }

  const page = await ensureEmryBrowserPage()
  const alive = await assertEmrySessionAlive(page)
  if (!alive.ok) {
    return { ok: false, kind: 'authentication', error: alive.reason }
  }

  logLine(`SkuByUpc lookup for ${upc}`)
  const result = await page.evaluate(async (code) => {
    const res = await fetch('/Controls/SkuByUpc.asmx/GetSkuByUpc', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ upc: code }),
    })
    const text = await res.text()
    return { status: res.status, text: text.slice(0, 500), finalUrl: location.href }
  }, upc)

  const pace = 1000 + Math.floor(Math.random() * 2000)
  logLine(`SkuByUpc pace ${pace}ms`)
  await pause(pace)

  if (/my\.policy|login/i.test(result.finalUrl) || result.status === 401 || result.status === 302) {
    return { ok: false, kind: 'authentication', error: 'Session expired during SkuByUpc.' }
  }

  let sku = ''
  try {
    const json = JSON.parse(result.text)
    sku = String(json?.d ?? '').trim()
  } catch {
    sku = ''
  }

  if (!SKU_RE.test(sku)) {
    logLine(`SkuByUpc miss for ${upc}`)
    return { ok: true, found: false, sku: '' }
  }

  logLine(`SkuByUpc hit ${sku}`)
  return { ok: true, found: true, sku }
}
