/**
 * Vendor scrape registry — register vendor-specific listing scrapers here.
 *
 * Vendor fork example:
 *   import { acmeScrapeListing } from './vendors/acmeScrape.mjs'
 *   registerVendorScraper('acme', acmeScrapeListing)
 * Then set VENDOR_INTEGRATION_ID in src/config/vendorIntegration.ts to 'acme'.
 */

import { emryVendorScrapeListing } from './emry/emryVendorScrape.mjs'
import { templateVendorScrapeListing } from './templateVendorScrape.mjs'

/** @type {Map<string, import('./vendorScrapeTypes.mjs').VendorScrapeHandler>} */
const scrapers = new Map()

const DEFAULT_VENDOR_ID = 'emry'

scrapers.set('emry', emryVendorScrapeListing)
scrapers.set('template', templateVendorScrapeListing)

/**
 * @param {string} vendorId
 * @param {import('./vendorScrapeTypes.mjs').VendorScrapeHandler} handler
 */
export function registerVendorScraper(vendorId, handler) {
  scrapers.set(vendorId, handler)
}

/**
 * @param {string} [vendorId]
 * @returns {import('./vendorScrapeTypes.mjs').VendorScrapeHandler}
 */
export function getVendorScraper(vendorId = DEFAULT_VENDOR_ID) {
  return scrapers.get(vendorId) ?? scrapers.get(DEFAULT_VENDOR_ID)
}
