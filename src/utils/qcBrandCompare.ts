/** Compare-only brand matching; does not mutate display values. */

function normalizeBrandForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(value: string): string[] {
  const n = normalizeBrandForCompare(value)
  if (!n) return []
  return n.split(' ').filter(Boolean)
}

/**
 * YES when any word from the shorter brand appears in the longer, or shorter words appear in order in longer.
 */
export function brandNamesMatchForCompare(vendorBrand: string, amazonBrand: string): boolean {
  const a = words(vendorBrand)
  const b = words(amazonBrand)
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
