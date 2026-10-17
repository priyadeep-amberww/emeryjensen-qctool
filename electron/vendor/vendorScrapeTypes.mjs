/**
 * @typedef {Record<string, string>} InputRow
 */

/**
 * @typedef {Object} VendorListingExtract
 * @property {'vendor_website'} source
 * @property {string} sku
 * @property {string} title
 * @property {string} brand
 * @property {string} line
 * @property {string} modelNumber
 * @property {string} packSize
 * @property {string} upc
 * @property {string} imageUrl
 * @property {string} pageUrl
 * @property {Record<string, string | number | boolean | null>} rawAttributes
 */

/**
 * @typedef {Object} VendorScrapeContext
 * @property {InputRow} row
 * @property {number} rowIndex
 * @property {boolean} headless
 * @property {string} [batchLabel]
 */

/**
 * @typedef {(ctx: VendorScrapeContext) => Promise<{ ok: true, extract: VendorListingExtract } | { ok: false, kind: string, error: string }>} VendorScrapeHandler
 */

export {}
