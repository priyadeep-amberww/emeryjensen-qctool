import type { SampleQcRow } from './sampleBatch'
import type { QcResult } from '../types/qc'
import { demoProductImageUrl } from '../utils/qcImages'

/**
 * Maps a demo sample row into the vendor-neutral QcResult shape.
 * Live Output UI never reads SampleQcRow fields directly.
 */
export function toQcResult(row: SampleQcRow): QcResult {
  const vendorImage = demoProductImageUrl(row.vendorSku, 'vendor')
  const amazonImage =
    row.verdict === 'FAIL'
      ? demoProductImageUrl(row.amazonAsin, 'alt')
      : row.verdict === 'MANUAL_REVIEW'
        ? vendorImage
        : demoProductImageUrl(row.amazonAsin, 'amazon')

  const sourceRawExtract = {
    source: 'vendor_website',
    sku: row.vendorSku,
    referenceId: row.referenceId,
    title: row.vendorTitle,
    modelNumber: row.vendorModel,
    packSize: row.vendorPack,
    price: row.vendorPrice,
    upc: row.vendorUpc,
    imageUrl: vendorImage,
    pageUrl: `https://vendor.example.com/products/${encodeURIComponent(row.vendorSku)}`,
    rawAttributes: {
      catalogStatus: 'Published',
      scrapeConfidence:
        row.verdict === 'PASS' ? 0.98 : row.verdict === 'FAIL' ? 0.94 : 0.81,
      currency: 'USD',
      lastCrawledAt: '2026-09-26T06:00:00.000Z',
    },
  }

  const targetRawExtract = {
    source: 'amazon',
    asin: row.amazonAsin,
    title: row.amazonTitle,
    modelNumber: row.amazonModel,
    packSize: row.amazonPack,
    price: row.amazonPrice,
    upc: row.amazonUpc,
    imageUrl: amazonImage,
    listingUrl: `https://www.amazon.com/dp/${encodeURIComponent(row.amazonAsin)}`,
    rawAttributes: {
      marketplace: 'US',
      listingStatus: 'Active',
      scrapeConfidence:
        row.verdict === 'PASS' ? 0.97 : row.verdict === 'FAIL' ? 0.91 : 0.72,
      mismatchHint:
        row.verdict === 'PASS'
          ? null
          : row.verdict === 'FAIL'
            ? 'title_model_price_upc'
            : 'model_upc_soft',
    },
  }

  return {
    id: row.referenceId,
    identity: [
      { key: 'reference', label: 'Reference', value: row.referenceId },
      { key: 'sku', label: 'SKU', value: row.vendorSku },
      { key: 'listing_id', label: 'Listing ID', value: row.amazonAsin },
    ],
    verdict: row.verdict,
    comparisons: [
      { key: 'title', label: 'Title', sourceValue: row.vendorTitle, targetValue: row.amazonTitle },
      { key: 'image', label: 'Image', sourceValue: vendorImage, targetValue: amazonImage },
      { key: 'model', label: 'Model Number', sourceValue: row.vendorModel, targetValue: row.amazonModel },
      { key: 'pack', label: 'Pack Size', sourceValue: row.vendorPack, targetValue: row.amazonPack },
      { key: 'price', label: 'Price', sourceValue: row.vendorPrice, targetValue: row.amazonPrice },
      { key: 'upc', label: 'UPC', sourceValue: row.vendorUpc, targetValue: row.amazonUpc },
    ],
    sourceColumnLabel: 'Vendor',
    targetColumnLabel: 'Amazon',
    sourceImageUrl: vendorImage,
    targetImageUrl: amazonImage,
    sourceRawExtract,
    targetRawExtract,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
  }
}
