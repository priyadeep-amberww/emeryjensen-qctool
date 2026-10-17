import { workerItemDetail, workerLookupUpc, workerSearchUpc } from './browserHost.mjs'
import { parseEjdHtml } from './extract/parseEjdHtml.mjs'
import { parseProductDetailHtml } from './extract/parseProductDetailHtml.mjs'
import {
  buildEjdRecordFromItemDetailHtml,
  mergeItemDetailIntoRecord,
  parseItemDetailSpecsHtml,
} from './extract/parseItemDetailSpecsHtml.mjs'
import { normalizeUpcDigits } from './extract/fieldHarvest.mjs'
import { ensureEmrySessionForScrape } from './vendorSessionManager.mjs'
import { EMRY_ACTIVE_STORE_ID } from './emryPortalUrls.mjs'

function pick(row, ...keys) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function normalizeUpc(raw) {
  return normalizeUpcDigits(raw)
}

/**
 * @param {string} lookupSku
 * @param {string} visibleSku
 * @param {string} parsedSku
 * @param {string} pageUpc
 * @param {string} rowUpc
 */
function resolveAuthoritativeSku(lookupSku, visibleSku, parsedSku, pageUpc, rowUpc) {
  if (pageUpc && pageUpc !== rowUpc) {
    return parsedSku || lookupSku || ''
  }
  if (parsedSku) return parsedSku
  if (lookupSku && visibleSku && lookupSku === visibleSku) return lookupSku
  if (lookupSku) return lookupSku
  if (visibleSku) return visibleSku
  return ''
}

/**
 * @param {string} upc
 * @param {string} lookupSku
 * @param {string[]} log
 */
async function captureFromItemDetailFallback(upc, lookupSku, log) {
  log.push(`Iframe parse failed; opening WhItemDetail for SKU ${lookupSku}`)
  const detail = await workerItemDetail(lookupSku)
  if (Array.isArray(detail.log)) log.push(...detail.log)
  if (!detail.ok || typeof detail.html !== 'string' || !detail.html.length) {
    log.push('WhItemDetail fallback unavailable')
    return { record: null, confidence: 0 }
  }

  const fromDetailPage = parseProductDetailHtml(detail.html, upc, {
    storeContext: EMRY_ACTIVE_STORE_ID,
  })
  if (fromDetailPage.status === 'captured' && fromDetailPage.record) {
    log.push('WhItemDetail parsed as product detail HTML')
    return { record: fromDetailPage.record, confidence: fromDetailPage.confidence ?? 0.8 }
  }

  const built = buildEjdRecordFromItemDetailHtml(lookupSku, upc, detail.html, {
    storeContext: EMRY_ACTIVE_STORE_ID,
  })
  if (built) {
    log.push('WhItemDetail built record from specs table')
    return { record: built, confidence: built.provenance?.parsing_confidence_score ?? 0.75 }
  }

  log.push('WhItemDetail HTML did not yield a record')
  return { record: null, confidence: 0 }
}

/**
 * Session-gated EMRY vendor capture: headed UPC search + HTML parse.
 * @param {import('../vendorScrapeTypes.mjs').VendorScrapeContext} ctx
 */
export async function emryVendorScrapeListing(ctx) {
  const session = await ensureEmrySessionForScrape()
  if (!session.ok) {
    return { ok: false, kind: session.kind, error: session.error }
  }

  const row = ctx.row ?? {}
  const partSku = pick(row, 'part_sku', 'sku') || `row-${ctx.rowIndex}`
  const rawUpc = pick(row, 'upc')
  const upc = normalizeUpc(rawUpc)
  if (!upc) {
    const shown = rawUpc || '(empty)'
    return {
      ok: true,
      captureStatus: 'bad_parse',
      extract: null,
      confidence: 0,
      log: [
        `Skipped UPC search: "${shown}" is not an 11- or 12-digit UPC. Marking FAIL with blank capture and continuing.`,
      ],
      partSku,
      upc: rawUpc,
      rowVerdict: 'FAIL',
    }
  }

  const lookup = await workerLookupUpc(upc)
  const log = Array.isArray(lookup.log) ? [...lookup.log] : []
  if (!lookup.ok) {
    return {
      ok: false,
      kind: lookup.kind ?? 'network',
      error: lookup.error ?? 'SkuByUpc lookup failed.',
      log,
    }
  }
  if (!lookup.found) {
    log.push(`UPC ${upc} is not in the EJD catalog`)
    return {
      ok: true,
      captureStatus: 'not_on_portal',
      extract: null,
      confidence: 0,
      log,
      partSku,
      upc,
    }
  }

  const lookupSku = String(lookup.sku ?? '').replace(/\D/g, '')

  const searchMessage = await workerSearchUpc(upc)
  if (Array.isArray(searchMessage.log)) log.push(...searchMessage.log)

  if (!searchMessage.ok) {
    return {
      ok: false,
      kind: searchMessage.kind ?? 'network',
      error: searchMessage.error ?? 'EJD portal search failed.',
      log,
    }
  }

  const fragment =
    typeof searchMessage.fragment === 'string' ? searchMessage.fragment : ''
  const upcMatched = searchMessage.upcMatched === true
  const htmlForParse =
    upcMatched && typeof searchMessage.html === 'string' && searchMessage.html.length > 0
      ? searchMessage.html
      : upcMatched && fragment
        ? fragment
        : ''
  const visibleSku = String(searchMessage.visibleSku ?? '').replace(/\D/g, '')
  const pageUpc = normalizeUpcDigits(searchMessage.pageUpc ?? '')

  if (searchMessage.pageKind) log.push(`EJD page kind: ${searchMessage.pageKind}`)
  if (searchMessage.frameUrl) log.push(`EJD frame: ${searchMessage.frameUrl}`)
  if (!upcMatched) {
    log.push(`Iframe UPC did not stabilize for ${upc}; skipping stale iframe HTML`)
  }

  let parsed = htmlForParse
    ? parseEjdHtml(htmlForParse, upc, { storeContext: EMRY_ACTIVE_STORE_ID })
    : { status: 'bad_parse', record: null, confidence: 0, cardCount: 0 }

  log.push(
    `Parser: ${parsed.status} · cards=${parsed.cardCount ?? 0} · confidence=${parsed.confidence?.toFixed?.(2) ?? parsed.confidence} · page=${parsed.pageKind ?? 'unknown'}`,
  )

  let record = parsed.status === 'captured' ? parsed.record : null
  let confidence = parsed.confidence ?? 0

  if (!record && lookupSku) {
    const fallback = await captureFromItemDetailFallback(upc, lookupSku, log)
    record = fallback.record
    confidence = fallback.confidence
    if (record) parsed = { ...parsed, status: 'captured', pageKind: 'item_detail' }
  }

  const parsedSku = record?.identity?.ejd_sku
    ? String(record.identity.ejd_sku).replace(/\D/g, '')
    : ''

  const authoritativeSku = resolveAuthoritativeSku(
    lookupSku,
    pageUpc === upc ? visibleSku : '',
    parsedSku,
    pageUpc,
    upc,
  )

  if (!record) {
    if (lookupSku) {
      log.push('Capture failed after iframe + WhItemDetail fallback')
      return {
        ok: true,
        captureStatus: 'bad_parse',
        extract: null,
        confidence,
        parseWarning: true,
        log,
        partSku,
        upc,
        cardCount: parsed.cardCount,
      }
    }
    return {
      ok: true,
      captureStatus: 'not_on_portal',
      extract: null,
      confidence: 0,
      log,
      partSku,
      upc,
    }
  }

  if (authoritativeSku && record.identity) {
    record.identity.ejd_sku = authoritativeSku
    if (!record.identity.upc) record.identity.upc = upc
  }

  const detail = await workerItemDetail(record.identity.ejd_sku)
  if (Array.isArray(detail.log)) log.push(...detail.log)
  if (detail.ok && typeof detail.html === 'string') {
    const specs = parseItemDetailSpecsHtml(detail.html)
    record = mergeItemDetailIntoRecord(record, specs)
    log.push(`Item detail merged; compliance ${record.compliance?.risk_level ?? 'UNKNOWN'}`)
  } else {
    log.push('Item detail refresh skipped or unavailable')
  }

  return {
    ok: true,
    captureStatus: 'captured',
    extract: record,
    confidence,
    parseWarning: parsed.parseWarning,
    log,
    partSku,
    upc,
    cardCount: parsed.cardCount,
  }
}
