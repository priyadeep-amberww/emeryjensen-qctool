const DEFAULT_PRICE_VARIANCE_PERCENT = 15

function normalizeLoose(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenSet(value) {
  return normalizeLoose(value).split(' ').filter(Boolean)
}

function titleSimilarityPercent(source, target) {
  const a = tokenSet(source)
  const b = tokenSet(target)
  if (a.length === 0 && b.length === 0) return 100
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const matches = a.filter((w) => setB.has(w)).length
  return Math.round((matches / Math.max(a.length, b.length)) * 100)
}

function picsumSeed(url) {
  const match = String(url).match(/\/seed\/([^/]+)\//)
  return match ? decodeURIComponent(match[1]) : url
}

function imageSimilarityPercent(sourceUrl, targetUrl) {
  if (!sourceUrl || !targetUrl) return 0
  if (sourceUrl === targetUrl) return 100
  return titleSimilarityPercent(picsumSeed(sourceUrl), picsumSeed(targetUrl))
}

function priceVariancePercent(source, target) {
  const parse = (value) => {
    const n = Number.parseFloat(String(value).replace(/[^0-9.-]+/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const s = parse(source)
  const t = parse(target)
  if (s === null || t === null) return 100
  if (s === 0 && t === 0) return 0
  const base = Math.max(Math.abs(s), Math.abs(t))
  if (base === 0) return 0
  return Math.round((Math.abs(s - t) / base) * 100)
}

function exactCompareOutcome(source, target) {
  if (!source || source === '—' || !target || target === '—') return 'REVIEW'
  return normalizeLoose(source) === normalizeLoose(target) ? 'MATCH' : 'MISMATCH'
}

function isBrandAliasMatch(vendorBrand, amazonBrand, aliases) {
  const vendor = String(vendorBrand).trim()
  const amazon = String(amazonBrand).trim()
  if (!vendor || !amazon || !Array.isArray(aliases) || aliases.length === 0) return false
  return aliases.some(
    (row) => String(row.vendorBrand ?? '').trim() === vendor && String(row.amazonBrand ?? '').trim() === amazon,
  )
}

function comparisonOutcomeForKey(key, sourceValue, targetValue, thresholds, brandAliases) {
  switch (key) {
    case 'title': {
      const sim = titleSimilarityPercent(sourceValue, targetValue)
      if (sim >= thresholds.titleSimilarityPercent) return 'MATCH'
      if (sim >= Math.round(thresholds.titleSimilarityPercent * 0.65)) return 'REVIEW'
      return 'MISMATCH'
    }
    case 'image': {
      const sim = imageSimilarityPercent(sourceValue, targetValue)
      if (sim >= thresholds.imageSimilarityPercent) return 'MATCH'
      if (sim >= Math.round(thresholds.imageSimilarityPercent * 0.65)) return 'REVIEW'
      return 'MISMATCH'
    }
    case 'price': {
      const variance = priceVariancePercent(sourceValue, targetValue)
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT) return 'MATCH'
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT + 10) return 'REVIEW'
      return 'MISMATCH'
    }
    case 'brand': {
      if (isBrandAliasMatch(sourceValue, targetValue, brandAliases)) return 'MATCH'
      return exactCompareOutcome(sourceValue, targetValue)
    }
    default:
      return exactCompareOutcome(sourceValue, targetValue)
  }
}

function deriveVerdict(comparisons) {
  if (comparisons.some((c) => c.outcome === 'MISMATCH')) return 'FAIL'
  if (comparisons.some((c) => c.outcome === 'REVIEW')) return 'MANUAL_REVIEW'
  return 'PASS'
}

function formatPriceUsd(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function pickRow(row, ...keys) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

import { runHaikuListingQc } from './anthropicHaiku.mjs'

/**
 * @param {import('../vendor/vendorScrapeTypes.mjs').VendorListingExtract} vendorExtract
 * @param {object} amazonExtract
 * @param {Record<string, string>} row
 * @param {object} thresholds
 * @param {Array<{ amazonBrand: string, vendorBrand: string }>} brandAliases
 */
export async function compareListings(
  vendorExtract,
  amazonExtract,
  row,
  thresholds,
  brandAliases = [],
) {
  const vendorPrice = formatPriceUsd(vendorExtract.rawAttributes?.priceUsd ?? 0)
  const amazonPrice = formatPriceUsd(amazonExtract.rawAttributes?.priceUsd ?? 0)

  const comparisons = [
    {
      key: 'title',
      label: 'Title',
      sourceValue: vendorExtract.title,
      targetValue: amazonExtract.title,
      outcome: comparisonOutcomeForKey(
        'title',
        vendorExtract.title,
        amazonExtract.title,
        thresholds,
        brandAliases,
      ),
    },
    {
      key: 'image',
      label: 'Image',
      sourceValue: vendorExtract.imageUrl,
      targetValue: amazonExtract.imageUrl,
      outcome: comparisonOutcomeForKey(
        'image',
        vendorExtract.imageUrl,
        amazonExtract.imageUrl,
        thresholds,
        brandAliases,
      ),
    },
    {
      key: 'price',
      label: 'Price',
      sourceValue: vendorPrice,
      targetValue: amazonPrice,
      outcome: comparisonOutcomeForKey('price', vendorPrice, amazonPrice, thresholds, brandAliases),
    },
    {
      key: 'brand',
      label: 'Brand',
      sourceValue: vendorExtract.brand,
      targetValue: amazonExtract.brand,
      outcome: comparisonOutcomeForKey(
        'brand',
        vendorExtract.brand,
        amazonExtract.brand,
        thresholds,
        brandAliases,
      ),
    },
    {
      key: 'model',
      label: 'Model Number',
      sourceValue: vendorExtract.modelNumber,
      targetValue: amazonExtract.modelNumber,
      outcome: comparisonOutcomeForKey(
        'model',
        vendorExtract.modelNumber,
        amazonExtract.modelNumber,
        thresholds,
        brandAliases,
      ),
    },
    {
      key: 'pack',
      label: 'Pack Size',
      sourceValue: vendorExtract.packSize,
      targetValue: amazonExtract.packSize,
      outcome: comparisonOutcomeForKey(
        'pack',
        vendorExtract.packSize,
        amazonExtract.packSize,
        thresholds,
        brandAliases,
      ),
    },
    {
      key: 'upc',
      label: 'UPC',
      sourceValue: vendorExtract.upc,
      targetValue: amazonExtract.upc,
      outcome: comparisonOutcomeForKey('upc', vendorExtract.upc, amazonExtract.upc, thresholds, brandAliases),
    },
  ]

  const sku = vendorExtract.sku || pickRow(row, 'part_sku', 'sku') || 'SKU-UNKNOWN'
  const asin = amazonExtract.asin || pickRow(row, 'asin')
  const brand = vendorExtract.brand || pickRow(row, 'brand')

  const identity = [
    { key: 'sku', label: 'SKU', value: sku },
    { key: 'listing_id', label: 'ASIN', value: asin },
    { key: 'brand', label: 'Brand', value: brand },
  ]

  const ai = await runHaikuListingQc({
    vendorExtract,
    amazonExtract,
    thresholds,
    brandAliases,
    comparisons,
  })

  const mergedComparisons = comparisons.map((row) => {
    const aiOutcome = ai.fieldOutcomes[row.key]
    if (!aiOutcome) return row
    return { ...row, outcome: aiOutcome }
  })

  const verdict =
    ai.verdict === 'PASS' || ai.verdict === 'FAIL' || ai.verdict === 'MANUAL_REVIEW'
      ? ai.verdict
      : deriveVerdict(mergedComparisons)

  return {
    identity,
    verdict,
    comparisons: mergedComparisons,
    asinExtract: amazonExtract,
    vendorExtract,
    inputTokens: ai.inputTokens,
    outputTokens: ai.outputTokens,
  }
}
