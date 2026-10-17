import { fetchAmazonListingByAsin } from '../amazon/fetchAmazonListingByAsin.mjs'
import { templateScrapeFailureFromRow } from '../errorEngineScrape.mjs'
import { getVendorScraper } from '../vendor/scrapeRegistry.mjs'
import { buildCaptureRowPayload } from './buildCaptureRow.mjs'
import { evaluateEjdQcGates } from './ejdQcGates.mjs'
import { applyQcComparisonRules } from './applyQcComparisonRules.mjs'
import { isRunHalted } from './runControl.mjs'

function haltedResponse() {
  return {
    ok: false,
    phase: 'vendor',
    kind: 'halted',
    error: 'QC run halted.',
  }
}

function pickAsin(row) {
  const asin = row?.asin
  if (typeof asin === 'string' && asin.trim()) return asin.trim().toUpperCase()
  return ''
}

/**
 * Capture-only row: vendor portal JSON first, then SP-API catalog JSON (no comparison).
 * @param {object} payload
 */
export async function processQcRow(payload) {
  const row = payload?.row
  if (!row || typeof row !== 'object') {
    return { ok: false, phase: 'vendor', error: 'Invalid row payload.' }
  }

  if (isRunHalted(payload.sessionId)) return haltedResponse()

  const asin = pickAsin(row)
  if (!asin) {
    return { ok: false, phase: 'amazon', error: 'Row is missing a valid ASIN.' }
  }

  const templateErr = templateScrapeFailureFromRow(row)
  if (templateErr) {
    return {
      ok: false,
      phase: 'vendor',
      error: templateErr.message,
      kind: templateErr.kind,
    }
  }

  const vendorId = typeof payload.vendorId === 'string' ? payload.vendorId : 'emry'
  const scraper = getVendorScraper(vendorId)
  const headless = vendorId === 'emry' ? false : payload.headless !== false
  const vendorResult = await scraper({
    row,
    rowIndex: typeof payload.rowIndex === 'number' ? payload.rowIndex : 0,
    headless,
    batchLabel: payload.batchLabel,
  })

  if (!vendorResult.ok) {
    if (vendorResult.kind === 'halted' || isRunHalted(payload.sessionId)) {
      return haltedResponse()
    }
    if (vendorResult.kind === 'parse') {
      const scrapeLog = [
        vendorResult.error || 'Row data cannot be searched. Marking FAIL and continuing.',
      ]
      const result = buildCaptureRowPayload({
        row,
        captureStatus: 'bad_parse',
        vendorExtract: null,
        amazonCatalogJson: null,
        scrapeLog,
        verdict: 'FAIL',
        comparisons: [],
      })
      return { ok: true, mode: 'capture', result }
    }
    return {
      ok: false,
      phase: 'vendor',
      error: vendorResult.error,
      kind: vendorResult.kind,
    }
  }

  if (vendorResult.rowVerdict === 'FAIL') {
    const result = buildCaptureRowPayload({
      row,
      captureStatus: vendorResult.captureStatus ?? 'bad_parse',
      vendorExtract: null,
      amazonCatalogJson: null,
      confidence: 0,
      scrapeLog: Array.isArray(vendorResult.log) ? vendorResult.log : [],
      verdict: 'FAIL',
      comparisons: [],
    })
    return { ok: true, mode: 'capture', result }
  }

  const scrapeLog = Array.isArray(vendorResult.log) ? [...vendorResult.log] : []
  let captureStatus = vendorResult.captureStatus ?? 'captured'
  let vendorExtract = vendorResult.extract ?? null
  let confidence = typeof vendorResult.confidence === 'number' ? vendorResult.confidence : undefined

  if (!captureStatus && vendorExtract) {
    captureStatus = 'captured'
  }
  if (!captureStatus) {
    captureStatus = vendorExtract ? 'captured' : 'bad_parse'
  }

  if (isRunHalted(payload.sessionId)) return haltedResponse()

  const amazonResult = await Promise.race([
    fetchAmazonListingByAsin(asin),
    new Promise((resolve) => {
      setTimeout(
        () => resolve({ ok: false, error: 'SP-API timed out; vendor scrape kept.' }),
        12_000,
      )
    }),
  ])
  let amazonCatalogJson = null

  if (!amazonResult.ok) {
    scrapeLog.push(`SP-API failed: ${amazonResult.error}`)
    if (captureStatus === 'captured') {
      captureStatus = 'sp_api_failed'
    }
  } else {
    amazonCatalogJson = amazonResult.catalogJson ?? null
    scrapeLog.push('SP-API catalog loaded')
  }

  const gates = await evaluateEjdQcGates({
    vendorExtract,
    catalogJson: amazonCatalogJson,
    captureStatus,
    asin,
  })
  scrapeLog.push(...gates.log)

  const qc = await applyQcComparisonRules({
    vendorExtract,
    catalogJson: amazonCatalogJson,
    settings: payload.settings ?? {},
    brandAliases: payload.brandAliases ?? [],
    gateComparisons: gates.comparisons,
    gateVerdict: gates.verdict,
  })
  scrapeLog.push(...qc.log)

  const result = buildCaptureRowPayload({
    row,
    captureStatus,
    vendorExtract,
    amazonCatalogJson,
    confidence,
    scrapeLog,
    verdict: qc.verdict,
    comparisons: qc.comparisons,
    inputTokens: qc.inputTokens,
    outputTokens: qc.outputTokens,
    amazonPackReport: qc.amazonPackReport,
  })

  return { ok: true, mode: 'capture', result }
}
