/** Compare-only model matching; does not mutate display values. */

function compactModel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function longestCommonSubstringLength(a: string, b: string): number {
  if (!a || !b) return 0
  let best = 0
  const prev = new Uint16Array(b.length + 1)
  const curr = new Uint16Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
        if (curr[j] > best) best = curr[j]
      } else {
        curr[j] = 0
      }
    }
    prev.set(curr)
    curr.fill(0)
  }
  return best
}

/** YES when longest contiguous shared run is at least half the longer compact string. */
export function modelNumbersMatchForCompare(vendorModel: string, amazonModel: string): boolean {
  const a = compactModel(vendorModel)
  const b = compactModel(amazonModel)
  if (!a || !b) return false
  const longest = Math.max(a.length, b.length)
  const run = longestCommonSubstringLength(a, b)
  return run >= Math.ceil(longest / 2)
}

function normalizeModelToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\d+\s*pk\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/^r\d+/, '')
    .replace(/0+/g, '0')
}

/** Align with electron qcFieldCompare.modelCompareOutcome for export UI. */
export function modelCompareOutcome(
  vendorModel: string,
  amazonModel: string,
): 'MATCH' | 'REVIEW' | 'MISMATCH' {
  const a = normalizeModelToken(vendorModel)
  const b = normalizeModelToken(amazonModel)
  if (!a || !b) return 'REVIEW'
  if (a === b) return 'MATCH'
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 4 && longer.includes(shorter)) return 'MATCH'
  if (modelNumbersMatchForCompare(vendorModel, amazonModel)) return 'MATCH'
  return 'MISMATCH'
}
