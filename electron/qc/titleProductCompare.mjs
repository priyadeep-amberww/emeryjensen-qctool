import { compactModelForCompare, modelCompareOutcome } from './qcFieldCompare.mjs'

const DIMENSION_RE =
  /\d+(?:\.\d+)?(?:\s*\/\s*\d+)?\s*(?:in|inch|inches|ft|feet|ga|awg|gpm|amp|amps|v|volt|volts|pk|pack|mm|cm)\b/gi

function normalizeDimToken(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/inches?|inch/g, 'in')
    .replace(/feet|foot/g, 'ft')
}

function significantTitleTokens(title) {
  const stop = new Set([
    'the',
    'and',
    'for',
    'with',
    'pk',
    'pack',
    'no',
    'size',
    'collection',
    'industries',
    'mfg',
    'co',
    'inc',
    'llc',
  ])
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w))
}

/**
 * Deterministic check: titles refer to the same physical product (short vendor titles OK).
 */
export function titlesReferToSameProduct(vendorTitle, amazonTitle, vendorModel, amazonModel) {
  const vendor = String(vendorTitle ?? '').trim()
  const amazon = String(amazonTitle ?? '').trim()
  if (!vendor || !amazon || vendor === '—' || amazon === '—') return false

  const modelOutcome = modelCompareOutcome(vendorModel, amazonModel)
  if (modelOutcome === 'MISMATCH') {
    return false
  }

  const modelParts = [vendorModel, amazonModel]
    .map((m) => compactModelForCompare(m))
    .filter((m) => m.length >= 3)
  const blob = `${vendor} ${amazon}`.toLowerCase()
  for (const part of modelParts) {
    if (blob.includes(part)) return true
  }

  const vDims = [...vendor.matchAll(DIMENSION_RE)].map((m) => normalizeDimToken(m[0]))
  const aDims = [...amazon.matchAll(DIMENSION_RE)].map((m) => normalizeDimToken(m[0]))
  if (vDims.length > 0 && aDims.length > 0) {
    const shared = vDims.filter((d) => aDims.some((a) => a === d || a.includes(d) || d.includes(a)))
    if (shared.length >= 1) {
      const vTokens = significantTitleTokens(vendor)
      const aTokens = significantTitleTokens(amazon)
      const overlap = vTokens.filter((t) => aTokens.includes(t))
      if (overlap.length >= 1 || vTokens.length <= 4) return true
    }
  }

  if (modelOutcome === 'MATCH') {
    const vTokens = significantTitleTokens(vendor)
    const aTokens = new Set(significantTitleTokens(amazon))
    const hits = vTokens.filter((t) => aTokens.has(t))
    if (hits.length >= Math.min(2, vTokens.length)) return true
    if (vTokens.length <= 5 && hits.length >= 1) return true
  }

  return false
}
