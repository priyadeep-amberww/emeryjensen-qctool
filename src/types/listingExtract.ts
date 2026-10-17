import type { QcCompareOutcome } from '../utils/qcThresholdComparison'
import type { QcIdentityField, QcVerdict } from './qc'

export type ListingRawAttributes = Record<string, string | number | boolean | null>

export type AmazonListingExtract = {
  source: 'amazon'
  asin: string
  title: string
  brand: string
  modelNumber: string
  packSize: string
  upc: string
  imageUrl: string
  listingUrl: string
  marketplace?: string
  rawAttributes: ListingRawAttributes
}

export type VendorListingExtract = {
  source: 'vendor_website'
  sku: string
  title: string
  brand: string
  line: string
  modelNumber: string
  packSize: string
  upc: string
  imageUrl: string
  pageUrl: string
  rawAttributes: ListingRawAttributes
}

export type ListingComparison = {
  key: string
  label: string
  sourceValue: string
  targetValue: string
  outcome: QcCompareOutcome
}

export type ListingQcPayload = {
  identity: QcIdentityField[]
  verdict: QcVerdict
  comparisons: ListingComparison[]
  asinExtract: AmazonListingExtract
  vendorExtract: VendorListingExtract
  inputTokens: number
  outputTokens: number
}

export type CaptureRowPayload = {
  captureStatus: import('./qc').CaptureStatus
  identity: QcIdentityField[]
  vendorExtract: unknown | null
  amazonCatalogJson: unknown | null
  scrapeLog: string[]
  confidence?: number
  verdict?: import('./qc').QcVerdict
  comparisons?: import('./qc').QcComparisonField[]
  inputTokens?: number
  outputTokens?: number
  amazonPackReport?: import('./qc').QcResult['amazonPackReport']
}

export type QcProcessRowSuccess =
  | { ok: true; mode: 'capture'; result: CaptureRowPayload }
  | { ok: true; mode?: 'compare'; result: ListingQcPayload }

export type QcProcessRowFailure = {
  ok: false
  phase: 'amazon' | 'vendor' | 'compare'
  error: string
  kind?: string
}

export type QcProcessRowResponse = QcProcessRowSuccess | QcProcessRowFailure
