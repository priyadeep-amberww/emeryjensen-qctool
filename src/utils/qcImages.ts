/**
 * Deterministic demo image URLs that actually load in the browser.
 * Seeded so the same SKU/ASIN always maps to the same photo.
 */
export function demoProductImageUrl(seed: string, variant: 'vendor' | 'amazon' | 'alt' = 'vendor'): string {
  const safe = encodeURIComponent(`${variant}-${seed}`.replace(/\s+/g, '-').toLowerCase())
  return `https://picsum.photos/seed/${safe}/240/240`
}

/** Pull image URLs from a QcResult (top-level fields or an `image` comparison row). */
export function resolveQcImageUrls(result: {
  sourceImageUrl?: string
  targetImageUrl?: string
  comparisons?: Array<{ key: string; sourceValue: string; targetValue: string }>
}): { sourceUrl?: string; targetUrl?: string } {
  if (result.sourceImageUrl || result.targetImageUrl) {
    return { sourceUrl: result.sourceImageUrl, targetUrl: result.targetImageUrl }
  }
  const imageField = result.comparisons?.find((c) => c.key === 'image')
  if (imageField) {
    return { sourceUrl: imageField.sourceValue, targetUrl: imageField.targetValue }
  }
  return {}
}
