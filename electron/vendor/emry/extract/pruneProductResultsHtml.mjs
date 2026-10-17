const NO_RECORDS_MARKERS = [
  'no items found',
  'no records to display',
  'no products found',
  'your search did not match',
]

const CONTENT_START_MARKERS = [
  'id="divProductResults"',
  'class="rgMasterTable"',
  'class="product-listing"',
  'id="contentMainPlaceHolder"',
]

const CONTENT_END_MARKERS = ['id="footer"', '</form>']

/**
 * @param {string} html
 * @returns {{ fragment: string; noRecords: boolean }}
 */
export function pruneProductResultsHtml(html) {
  if (!html || typeof html !== 'string') {
    return { fragment: '', noRecords: true }
  }

  let working = html
  working = working.replace(/<input[^>]*id="__VIEWSTATE"[^>]*>/gi, '')
  working = working.replace(/<input[^>]*id="__EVENTVALIDATION"[^>]*>/gi, '')

  const lower = working.toLowerCase()
  const noRecords = NO_RECORDS_MARKERS.some((m) => lower.includes(m))

  let start = -1
  for (const marker of CONTENT_START_MARKERS) {
    const idx = lower.indexOf(marker.toLowerCase())
    if (idx >= 0) {
      start = idx
      break
    }
  }

  if (start < 0) {
    return { fragment: working.slice(0, Math.min(working.length, 80_000)), noRecords }
  }

  let end = working.length
  const tail = lower.slice(start)
  for (const marker of CONTENT_END_MARKERS) {
    const rel = tail.indexOf(marker.toLowerCase())
    if (rel >= 0) {
      end = Math.min(end, start + rel)
    }
  }

  const fragment = working.slice(start, end)
  return { fragment, noRecords }
}
