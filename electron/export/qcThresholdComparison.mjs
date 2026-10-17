import {
  brandNamesMatchForCompare,
  modelCompareOutcome,
  titleSimilarityPercent,
  upcDigitsEqual,
} from '../qc/qcFieldCompare.mjs'

const DEFAULT_PRICE_VARIANCE_PERCENT = 15

export function normalizeLoose(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function picsumSeed(url) {
  const match = String(url).match(/\/seed\/([^/]+)\//)
  return match ? decodeURIComponent(match[1]) : url
}

export function imageSimilarityPercent(sourceUrl, targetUrl) {
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

export function exactCompareOutcome(source, target) {
  if (!source || source === '—' || !target || target === '—') return 'REVIEW'
  return normalizeLoose(source) === normalizeLoose(target) ? 'MATCH' : 'MISMATCH'
}

export function comparisonOutcomeForKey(key, sourceValue, targetValue, thresholds, _options, field) {
  if (key === 'pack') {
    return exactCompareOutcome(sourceValue, targetValue) === 'MATCH' ? 'MATCH' : 'MISMATCH'
  }
  if (field?.outcome === 'MATCH' || field?.outcome === 'MISMATCH' || field?.outcome === 'REVIEW') {
    return field.outcome
  }

  switch (key) {
    case 'title': {
      if (field?.scorePercent != null) {
        return field.scorePercent >= thresholds.titleSimilarityPercent ? 'MATCH' : 'MISMATCH'
      }
      return 'REVIEW'
    }
    case 'image': {
      if (field?.scorePercent != null) {
        return field.scorePercent >= thresholds.imageSimilarityPercent ? 'MATCH' : 'MISMATCH'
      }
      const sim = imageSimilarityPercent(sourceValue, targetValue)
      return sim >= thresholds.imageSimilarityPercent ? 'MATCH' : 'MISMATCH'
    }
    case 'description': {
      const sim = titleSimilarityPercent(sourceValue, targetValue)
      if (!sourceValue || !targetValue || sourceValue === '—' || targetValue === '—') return 'REVIEW'
      return sim >= (thresholds.descriptionSimilarityPercent ?? 70) ? 'MATCH' : 'MISMATCH'
    }
    case 'specifications': {
      const sim = titleSimilarityPercent(sourceValue, targetValue)
      if (!sourceValue || !targetValue || sourceValue === '—' || targetValue === '—') return 'REVIEW'
      return sim >= (thresholds.specificationSimilarityPercent ?? 70) ? 'MATCH' : 'MISMATCH'
    }
    case 'price': {
      const variance = priceVariancePercent(sourceValue, targetValue)
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT) return 'MATCH'
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT + 10) return 'REVIEW'
      return 'MISMATCH'
    }
    case 'brand': {
      const s = String(sourceValue ?? '').trim()
      const t = String(targetValue ?? '').trim()
      if (!s || !t || s === '—' || t === '—') return 'REVIEW'
      return brandNamesMatchForCompare(sourceValue, targetValue) ? 'MATCH' : 'MISMATCH'
    }
    case 'model':
      return modelCompareOutcome(sourceValue, targetValue)
    case 'upc':
      return upcDigitsEqual(sourceValue, targetValue) ? 'MATCH' : 'MISMATCH'
    default:
      return exactCompareOutcome(sourceValue, targetValue)
  }
}

export const DEFAULT_QC_THRESHOLDS = {
  titleSimilarityPercent: 70,
  imageSimilarityPercent: 70,
  descriptionSimilarityPercent: 70,
  specificationSimilarityPercent: 70,
}
