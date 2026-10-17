/** Compare-only brand/model helpers (mirror of renderer utils). */

function normalizeBrandForCompare(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function brandWords(value) {
  const n = normalizeBrandForCompare(value)
  if (!n) return []
  return n.split(' ').filter(Boolean)
}

export function brandNamesMatchForCompare(vendorBrand, amazonBrand) {
  const a = brandWords(vendorBrand)
  const b = brandWords(amazonBrand)
  if (a.length === 0 || b.length === 0) return false
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  const longerSet = new Set(longer)
  if (shorter.some((w) => longerSet.has(w))) return true
  const shorterPhrase = shorter.join(' ')
  const longerPhrase = longer.join(' ')
  if (shorterPhrase && longerPhrase.includes(shorterPhrase)) return true
  return false
}

export function compactModelForCompare(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function compactModel(value) {
  return compactModelForCompare(value)
}

function modelPartTokens(value) {
  const raw = String(value ?? '').toUpperCase()
  const tokens = raw.match(/[A-Z0-9]{3,}/g) ?? []
  return [...new Set(tokens.map((t) => compactModelForCompare(t)).filter((t) => t.length >= 3))]
}

function longestCommonSubstringLength(a, b) {
  if (!a || !b) return 0
  let best = 0
  const prev = new Array(b.length + 1).fill(0)
  const curr = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
        if (curr[j] > best) best = curr[j]
      } else {
        curr[j] = 0
      }
    }
    prev.splice(0, prev.length, ...curr)
    curr.fill(0)
  }
  return best
}

export function modelNumbersMatchForCompare(vendorModel, amazonModel) {
  const a = compactModel(vendorModel)
  const b = compactModel(amazonModel)
  if (!a || !b) return false
  const longest = Math.max(a.length, b.length)
  const run = longestCommonSubstringLength(a, b)
  return run >= Math.ceil(longest / 2)
}

function normalizeModelToken(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b\d+\s*pk\b/gi, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^r\d+/, '')
    .replace(/0+/g, '0')
}

function sharedModelTokenMatch(vendorModel, amazonModel) {
  const aTokens = modelPartTokens(vendorModel)
  const bTokens = modelPartTokens(amazonModel)
  if (aTokens.length === 0 || bTokens.length === 0) return false
  for (const t of aTokens) {
    if (t.length < 4) continue
    for (const u of bTokens) {
      if (t === u) return true
      if (t.length >= 5 && u.length >= 5 && (t.includes(u) || u.includes(t))) return true
    }
  }
  return false
}

/**
 * @returns {'MATCH'|'REVIEW'|'MISMATCH'}
 */
export function modelCompareOutcome(vendorModel, amazonModel) {
  const a = normalizeModelToken(vendorModel)
  const b = normalizeModelToken(amazonModel)
  if (!a || !b) return 'REVIEW'
  if (a === b) return 'MATCH'
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 4 && longer.includes(shorter)) return 'MATCH'
  if (sharedModelTokenMatch(vendorModel, amazonModel)) return 'MATCH'
  if (modelNumbersMatchForCompare(vendorModel, amazonModel)) return 'MATCH'
  return 'MISMATCH'
}

export function upcDigitsEqual(vendorUpc, amazonUpc) {
  const strip = (value) => String(value ?? '').replace(/\D/g, '')
  const a = strip(vendorUpc)
  const b = strip(amazonUpc)
  if (!a || !b) return false
  const trimLeading = (digits) => digits.replace(/^0+/, '') || '0'
  return trimLeading(a) === trimLeading(b)
}

export function titleSimilarityPercent(source, target) {
  const normalizeLoose = (value) =>
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const tokenSet = (value) => normalizeLoose(value).split(' ').filter(Boolean)
  const a = tokenSet(source)
  const b = tokenSet(target)
  if (a.length === 0 && b.length === 0) return 100
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const matches = a.filter((w) => setB.has(w)).length
  return Math.round((matches / Math.max(a.length, b.length)) * 100)
}
