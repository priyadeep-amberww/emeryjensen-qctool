export function templateScrapeFailureFromRow(row) {
  const sku = String(row.part_sku ?? row.sku ?? '').trim()
  if (!sku) return null
  const upper = sku.toUpperCase()
  if (!upper.includes('SCRAPE_FAIL')) return null

  let kind = 'network'
  if (upper.includes('AUTH')) kind = 'authentication'
  else if (upper.includes('TIMEOUT')) kind = 'timeout'

  return { kind, message: `Scrape failed for ${sku} (${kind})` }
}
