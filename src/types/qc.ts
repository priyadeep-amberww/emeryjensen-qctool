/** Vendor-neutral QC result types for the reusable QC Template. */

export type QcVerdict = 'PASS' | 'FAIL' | 'MANUAL_REVIEW'

export type CaptureStatus = 'captured' | 'not_on_portal' | 'bad_parse' | 'sp_api_failed'

export type QcProcessStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'

/** Product identity fields shown in the live results table (labels come from the vendor tool). */
export type QcIdentityField = {
  key: string
  label: string
  value: string
}

export type QcCompareOutcome = 'MATCH' | 'MISMATCH' | 'REVIEW'

/** One compared attribute; field set varies by vendor. */
export type QcComparisonField = {
  key: string
  label: string
  sourceValue: string
  targetValue: string
  /** Set at capture time when comparison is pre-scored (live EJD QC). */
  outcome?: QcCompareOutcome
  /** Similarity percent for image / description / specifications rows. */
  scorePercent?: number
}

/**
 * One finished SKU / product QC result.
 * Structure is fixed; identity + comparison fields are supplied by the vendor tool.
 */
export type QcResult = {
  id: string
  identity: QcIdentityField[]
  /** Omitted for headed capture-only rows (no QC verdict yet). */
  verdict?: QcVerdict
  /** Present when the row is a vendor + Amazon JSON capture pair. */
  captureStatus?: CaptureStatus
  comparisons: QcComparisonField[]
  /** Optional column headers for the comparison detail view. */
  sourceColumnLabel?: string
  targetColumnLabel?: string
  /** Product image URLs for Vendor (source) and Amazon (target) inspection. */
  sourceImageUrl?: string
  targetImageUrl?: string
  /**
   * Complete raw scrape payloads for the SKU viewer.
   * Vendor tool supplies whatever shape it scraped; UI renders JSON as-is.
   */
  sourceRawExtract?: unknown
  targetRawExtract?: unknown
  /** Step log from portal search, parser, and SP-API (capture pipeline). */
  scrapeLog?: string[]
  inputTokens?: number
  outputTokens?: number
  /** Amazon pack engine + SP-API pairs captured with the row (Excel tail columns). */
  amazonPackReport?: {
    spApiPairs: string
    outerPack: string
    confidence: number | string
    methods: string
    evidence: string
    innerCount: string
    innerUnitType: string
    innerEvidence: string
    innerSource: string
    signals: string
    warnings: string[] | string
    engineVersion: string
  }
}

export type { QcLogEntry, LogCategory, LogCategoryInput, AppendLogInput } from './log'
export { LOG_CATEGORIES } from './log'
