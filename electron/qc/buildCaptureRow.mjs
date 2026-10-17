function pick(row, ...keys) {
  for (const key of keys) {
    const v = row?.[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/**
 * @param {object} input
 * @param {Record<string, string>} input.row
 * @param {string} input.captureStatus
 * @param {unknown | null} input.vendorExtract
 * @param {unknown | null} input.amazonCatalogJson
 * @param {number} [input.confidence]
 * @param {string[]} [input.scrapeLog]
 * @param {string} [input.verdict]
 * @param {object[]} [input.comparisons]
 */
export function buildCaptureRowPayload(input) {
  const row = input.row ?? {}
  const partSku = pick(row, 'part_sku', 'sku') || 'SKU-UNKNOWN'
  const asin = pick(row, 'asin').toUpperCase()
  const upc = pick(row, 'upc')
  const ejdSku =
    input.vendorExtract &&
    typeof input.vendorExtract === 'object' &&
    input.vendorExtract.identity?.ejd_sku
      ? String(input.vendorExtract.identity.ejd_sku)
      : ''

  const identity = [
    { key: 'sku', label: 'PART SKU', value: partSku },
    { key: 'listing_id', label: 'ASIN', value: asin || '—' },
    { key: 'upc', label: 'UPC', value: upc || '—' },
  ]
  if (ejdSku) {
    identity.push({ key: 'ejd_sku', label: 'EJD SKU', value: ejdSku })
  }
  if (typeof input.confidence === 'number' && input.confidence > 0) {
    identity.push({
      key: 'confidence',
      label: 'Parse confidence',
      value: input.confidence.toFixed(2),
    })
  }

  return {
    captureStatus: input.captureStatus,
    identity,
    vendorExtract: input.vendorExtract ?? null,
    amazonCatalogJson: input.amazonCatalogJson ?? null,
    scrapeLog: Array.isArray(input.scrapeLog) ? input.scrapeLog : [],
    confidence: input.confidence,
    verdict: input.verdict,
    comparisons: Array.isArray(input.comparisons) ? input.comparisons : [],
    inputTokens: typeof input.inputTokens === 'number' ? input.inputTokens : undefined,
    outputTokens: typeof input.outputTokens === 'number' ? input.outputTokens : undefined,
    amazonPackReport: input.amazonPackReport ?? undefined,
  }
}
