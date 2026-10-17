const CORE_KEYS = ['title', 'brand', 'pack', 'model', 'upc', 'image']

function rowByKey(comparisons, key) {
  return comparisons.find((c) => c.key === key)
}

/**
 * PASS only when all six core checks are MATCH. Anything else is FAIL.
 * @param {object} input
 * @param {object[]} input.comparisons
 */
export function combineQcVerdict(input) {
  const comparisons = input.comparisons ?? []
  for (const key of CORE_KEYS) {
    if (rowByKey(comparisons, key)?.outcome !== 'MATCH') return 'FAIL'
  }
  return 'PASS'
}
