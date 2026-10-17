const CORE_FAIL_KEYS = ['brand', 'model', 'title', 'pack', 'image', 'upc']

function rowByKey(comparisons, key) {
  return comparisons.find((c) => c.key === key)
}

function upcMatched(comparisons) {
  return rowByKey(comparisons, 'upc')?.outcome === 'MATCH'
}

/**
 * @param {object} input
 * @param {object[]} input.comparisons
 * @param {'PASS'|'FAIL'|'MANUAL_REVIEW'} input.gateVerdict
 * @param {boolean} input.titleHasOutcome
 * @param {boolean} input.imageHasOutcome
 */
function coreProductIdentityPass(comparisons, titleHasOutcome) {
  const upc = rowByKey(comparisons, 'upc')
  const model = rowByKey(comparisons, 'model')
  const title = rowByKey(comparisons, 'title')
  const pack = rowByKey(comparisons, 'pack')
  if (upc?.outcome !== 'MATCH') return false
  if (!model || model.outcome === 'MISMATCH') return false
  if (!titleHasOutcome || title?.outcome !== 'MATCH') return false
  if (pack?.outcome === 'MISMATCH') return false
  return true
}

export function combineQcVerdict(input) {
  const { comparisons, gateVerdict, titleHasOutcome, imageHasOutcome } = input

  if (gateVerdict === 'FAIL') return 'FAIL'

  if (coreProductIdentityPass(comparisons, titleHasOutcome)) {
    return 'PASS'
  }

  const identityConfirmed = upcMatched(comparisons)
  const modelMatched = rowByKey(comparisons, 'model')?.outcome === 'MATCH'
  let needsManualReview = false

  for (const key of CORE_FAIL_KEYS) {
    const row = rowByKey(comparisons, key)
    if (key === 'title') {
      if (!titleHasOutcome) continue
      if (row?.outcome === 'MISMATCH') {
        if (identityConfirmed) {
          needsManualReview = true
          continue
        }
        return 'FAIL'
      }
      continue
    }
    if (key === 'image') {
      if (!imageHasOutcome) continue
      if (row?.outcome === 'MISMATCH') {
        if (identityConfirmed) {
          needsManualReview = true
          continue
        }
        return 'FAIL'
      }
      continue
    }
    if (key === 'brand' && row?.outcome === 'MISMATCH') {
      if (identityConfirmed && modelMatched) {
        needsManualReview = true
        continue
      }
      return 'FAIL'
    }
    if (!row) return 'FAIL'
    if (row.outcome === 'REVIEW') continue
    if (row.outcome !== 'MATCH') return 'FAIL'
  }

  if (needsManualReview) return 'MANUAL_REVIEW'
  if (!titleHasOutcome || !imageHasOutcome) return 'MANUAL_REVIEW'
  if (gateVerdict === 'MANUAL_REVIEW') return 'MANUAL_REVIEW'

  return 'PASS'
}
