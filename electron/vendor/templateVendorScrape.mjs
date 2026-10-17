/**
 * Template vendor scraper — deterministic placeholder until a vendor implements real browser/HTML scraping.
 */

function pick(row, ...keys) {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/**
 * @param {import('./vendorScrapeTypes.mjs').VendorScrapeContext} ctx
 */
export async function templateVendorScrapeListing(ctx) {
  const row = ctx.row ?? {}
  const sku = pick(row, 'part_sku', 'sku') || `row-${ctx.rowIndex}`
  const asin = pick(row, 'asin') || 'B08AB1CD2E'
  const brand = pick(row, 'brand') || 'Acme'
  const line = pick(row, 'line') || 'Pro'
  const upc = pick(row, 'upc') || '012345678905'
  const title = `${brand} ${line} ${sku}`.trim()
  const modelNumber = sku.replace(/^SKU-?/i, '') || 'A1'

  const extract = {
    source: 'vendor_website',
    sku,
    title,
    brand,
    line,
    modelNumber,
    packSize: '1',
    upc,
    imageUrl: `https://picsum.photos/seed/${encodeURIComponent(sku)}-vendor/400/400`,
    pageUrl: `https://vendor.example.com/products/${encodeURIComponent(sku)}`,
    rawAttributes: {
      catalogStatus: 'Published',
      scrapeConfidence: 0.98,
      currency: 'USD',
      priceUsd: 16.52,
      templatePlaceholder: true,
      asinHint: asin,
      lastCrawledAt: new Date().toISOString(),
    },
  }

  return { ok: true, extract }
}
