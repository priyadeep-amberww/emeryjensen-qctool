/**
 * Vendor-neutral pagination math — shared by the Pagination UI and any page
 * that windows a large list without mutating the underlying dataset.
 */

export type PageToken = number | 'ellipsis'

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems <= 0 || pageSize <= 0) return 0
  return Math.ceil(totalItems / pageSize)
}

/** Clamp a 1-based page into a valid range for the given totals. */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1
  return Math.min(Math.max(1, page), totalPages)
}

/**
 * Inclusive start / exclusive end indexes for `array.slice(start, end)`.
 * Display-only — does not truncate the source collection.
 */
export function getPageItemRange(
  page: number,
  pageSize: number,
  totalItems: number,
): { start: number; end: number } {
  if (totalItems <= 0 || pageSize <= 0) return { start: 0, end: 0 }
  const totalPages = getTotalPages(totalItems, pageSize)
  const safePage = clampPage(page, totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, totalItems)
  return { start, end }
}

function range(from: number, to: number): number[] {
  if (to < from) return []
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

/**
 * Compact page-number tokens for large page counts (1000+).
 * Never returns one button per page when totals are huge — only a small
 * window plus ellipses, e.g. `1 2 3 … 998 999 1000`.
 */
export function buildPageTokens(
  currentPage: number,
  totalPages: number,
  options?: { siblingCount?: number; boundaryCount?: number },
): PageToken[] {
  if (totalPages <= 0) return []

  const siblingCount = options?.siblingCount ?? 1
  const boundaryCount = options?.boundaryCount ?? 1
  const page = clampPage(currentPage, totalPages)

  // siblingCount*2 + current + 2 ellipsis + 2*boundary + (gap fillers)
  const totalNumbers = siblingCount * 2 + boundaryCount * 2 + 3

  if (totalNumbers >= totalPages) {
    return range(1, totalPages)
  }

  const startPages = range(1, boundaryCount)
  const endPages = range(totalPages - boundaryCount + 1, totalPages)

  const siblingsStart = Math.max(
    Math.min(page - siblingCount, totalPages - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  )
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    totalPages - boundaryCount - 1,
  )

  const tokens: PageToken[] = [...startPages]

  if (siblingsStart > boundaryCount + 2) {
    tokens.push('ellipsis')
  } else if (boundaryCount + 1 < siblingsStart) {
    tokens.push(boundaryCount + 1)
  }

  tokens.push(...range(siblingsStart, siblingsEnd))

  if (siblingsEnd < totalPages - boundaryCount - 1) {
    tokens.push('ellipsis')
  } else if (siblingsEnd + 1 < totalPages - boundaryCount + 1) {
    tokens.push(siblingsEnd + 1)
  }

  tokens.push(...endPages)
  return tokens
}
