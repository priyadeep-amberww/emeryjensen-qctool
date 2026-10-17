import { EJD_HOME_URL } from './emryPortalUrls.mjs'
import { ensureEmryBrowserPage } from './browserSession.mjs'
import { assertEmrySessionAlive, isF5LogoutVisible } from './sessionWatch.mjs'
import { pruneProductResultsHtml } from './extract/pruneProductResultsHtml.mjs'
import {
  extractSkuFromLabels,
  extractUpcForTarget,
} from './extract/fieldHarvest.mjs'
import { isProductDetailPage } from './extract/parseProductDetailHtml.mjs'

const SEARCH_TIMEOUT_MS = 25_000
const RESULTS_POLL_MS = 400
const PACE_MIN_MS = 800
const PACE_MAX_MS = 1600
const KEEPALIVE_MS = 60 * 60 * 1000
const MIN_NAV_MS = 600

const FRAME_URL_RE = /ProductResults|WhProduct|ItemDetail|ProductDetail/i

let lastNavigationAt = 0

async function keepAliveIfStale(page, logLine) {
  if (!lastNavigationAt || Date.now() - lastNavigationAt < KEEPALIVE_MS) return
  logLine('Session keep-alive: reloading EJD home')
  await page.goto(EJD_HOME_URL, { waitUntil: 'domcontentloaded', timeout: SEARCH_TIMEOUT_MS })
  lastNavigationAt = Date.now()
}

function markNavigated() {
  lastNavigationAt = Date.now()
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomPaceMs() {
  return PACE_MIN_MS + Math.floor(Math.random() * (PACE_MAX_MS - PACE_MIN_MS + 1))
}

/**
 * @param {string} url
 */
function pageKindFromUrl(url) {
  if (/ProductResults/i.test(url)) return 'product_results'
  if (/ProductDetail|WhProduct/i.test(url)) return 'product_detail'
  return 'unknown'
}

function frameMatchesSearch(frameUrl, upc) {
  if (!frameUrl) return false
  if (frameUrl.includes(upc)) return true
  try {
    const encoded = encodeURIComponent(upc)
    if (frameUrl.includes(encoded)) return true
  } catch {
    // ignore
  }
  return /ProductResults|WhProduct|ProductDetail/i.test(frameUrl)
}

/**
 * @param {string} upc12
 * @param {(line: string) => void} logLine
 */
export async function searchProductByUpcInPortal(upc12, logLine) {
  const upc = String(upc12 ?? '').replace(/\D/g, '')
  if (upc.length !== 12) {
    return { ok: false, kind: 'parse', error: `UPC must be 12 digits, got "${upc12}".` }
  }

  const page = await ensureEmryBrowserPage()
  await keepAliveIfStale(page, logLine)
  const alive = await assertEmrySessionAlive(page)
  if (!alive.ok) {
    return { ok: false, kind: 'authentication', error: alive.reason }
  }

  if (await isF5LogoutVisible(page)) {
    return { ok: false, kind: 'authentication', error: 'Session expired (F5 logout page)' }
  }

  const queryKey = { QueryText: upc, FacetList: null, TypeaheadField: '' }
  const q = encodeURIComponent(JSON.stringify(queryKey))
  const relativePath = `WhProductSearch/ProductResults.aspx?q=${q}&_=${Date.now()}`

  logLine(`EJD search started for UPC ${upc}`)
  const started = Date.now()

  if (!page.url().includes('AppHost.aspx')) {
    logLine('Navigating to EJD home shell')
    await page.goto(EJD_HOME_URL, { waitUntil: 'domcontentloaded', timeout: SEARCH_TIMEOUT_MS })
    markNavigated()
  }

  const aliveAfterNav = await assertEmrySessionAlive(page)
  if (!aliveAfterNav.ok) {
    return { ok: false, kind: 'authentication', error: alive.reason }
  }

  markNavigated()
  await page.evaluate((path) => {
    const iframe = document.getElementById('iframeAppHost')
    if (iframe) {
      iframe.src = path
    }
  }, relativePath)

  let iframeHtml = ''
  let visibleSku = ''
  let frameUrl = ''
  let pageKind = 'unknown'
  let pageUpc = ''
  const deadline = Date.now() + SEARCH_TIMEOUT_MS

  while (Date.now() < deadline) {
    const hit = page.frames().find((frame) => FRAME_URL_RE.test(frame.url()))
    if (!hit) {
      await pause(RESULTS_POLL_MS)
      continue
    }

    try {
      frameUrl = hit.url()
      pageKind = pageKindFromUrl(frameUrl)
      const elapsed = Date.now() - started
      if (!frameMatchesSearch(frameUrl, upc) && elapsed < MIN_NAV_MS) {
        await pause(RESULTS_POLL_MS)
        continue
      }

      const html = await hit.content()
      const text = await hit.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      pageUpc = extractUpcForTarget(html, upc)

      const contentReady =
        isProductDetailPage(html) ||
        /divProductResults|rgMasterTable|product-listing|Results for/i.test(html) ||
        /Add to Cart/i.test(text)

      if (!contentReady) {
        await pause(RESULTS_POLL_MS)
        continue
      }

      if (pageUpc && pageUpc !== upc) {
        logLine(`Waiting for navigation (page UPC ${pageUpc} ≠ search ${upc})`)
        await pause(RESULTS_POLL_MS)
        continue
      }

      const skuMatch = text.match(/SKU\s*:\s*(\d{5,7})\b/i)
      const labelSku = extractSkuFromLabels(html)
      if (skuMatch && (!pageUpc || pageUpc === upc)) {
        visibleSku = skuMatch[1]
      } else if (labelSku && (!pageUpc || pageUpc === upc)) {
        visibleSku = labelSku
      }

      if (pageUpc === upc || (elapsed >= MIN_NAV_MS && frameMatchesSearch(frameUrl, upc))) {
        iframeHtml = html
        if (visibleSku) logLine(`Visible EJD SKU on page: ${visibleSku}`)
        if (pageUpc) logLine(`UPC on page: ${pageUpc}`)
        break
      }
    } catch {
      // Frame is still navigating.
    }

    await pause(RESULTS_POLL_MS)
  }

  if (!iframeHtml) {
    logLine('Product frame did not reach target UPC before timeout; reading best-effort frame')
    const hit = page.frames().find((frame) => FRAME_URL_RE.test(frame.url()))
    if (hit) {
      try {
        iframeHtml = await hit.content()
        frameUrl = hit.url()
        pageUpc = extractUpcForTarget(iframeHtml, upc)
        pageKind = pageKindFromUrl(frameUrl)
      } catch {
        iframeHtml = ''
      }
    }
  }

  if (!iframeHtml) {
    try {
      iframeHtml = await page.content()
      frameUrl = page.url()
    } catch {
      iframeHtml = ''
    }
  }

  if (isProductDetailPage(iframeHtml)) {
    pageKind = 'product_detail'
  }

  pageUpc = extractUpcForTarget(iframeHtml, upc)
  if (pageUpc && pageUpc !== upc) {
    logLine(`Final page UPC ${pageUpc} still mismatches search ${upc}`)
    visibleSku = ''
  }

  const elapsedMs = Date.now() - started
  const { fragment, noRecords } = pruneProductResultsHtml(iframeHtml)
  logLine(
    `EJD iframe loaded in ${elapsedMs}ms · kind=${pageKind} · fragment ${fragment.length} bytes · noRecords=${noRecords}`,
  )

  const paceMs = randomPaceMs()
  logLine(`Pacing ${paceMs}ms before next portal action`)
  await pause(paceMs)

  return {
    ok: true,
    html: iframeHtml,
    fragment,
    visibleSku,
    pageUpc,
    pageKind,
    frameUrl,
    noRecords,
    elapsedMs,
    upcMatched: pageUpc === upc,
    searchUrl: `${EJD_HOME_URL.replace('AppHost.aspx?p=Home', '')}${relativePath}`,
  }
}
