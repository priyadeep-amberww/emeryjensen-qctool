/** Vendor-neutral application settings (persisted locally). */

/** Allowed range for Title / Image similarity thresholds in Settings. */
export const QC_SIMILARITY_THRESHOLD_MIN = 5
export const QC_SIMILARITY_THRESHOLD_MAX = 100

export type QcThresholdSettings = {
  /** Legacy / sandbox title token threshold (live capture uses Haiku for title). */
  titleSimilarityPercent: number
  /** Min image similarity required to pass (5–100). */
  imageSimilarityPercent: number
  /** Min description token similarity for manual-review extras (5–100). */
  descriptionSimilarityPercent: number
  /** Min specifications token similarity for manual-review extras (5–100). */
  specificationSimilarityPercent: number
}

export type ScrapingBehaviorSettings = {
  /** When true, authenticate before scraping (SWDT-style); when false, scrape without login (GLID-style). */
  vendorLoginRequired: boolean
  /** Reuse an authenticated vendor session when available. */
  reuseVendorSession: boolean
  /** Run vendor browser headless; when false, allow a visible window. */
  headlessScraping: boolean
}

export const ERROR_ENGINE_RETRY_MIN = 3
export const ERROR_ENGINE_RETRY_MAX = 5
export const ERROR_ENGINE_BACKOFF_MIN_MS = 500
export const ERROR_ENGINE_BACKOFF_MAX_MS = 30_000

export type ErrorEngineSettings = {
  /** Global automatic scrape error recovery (pause → relogin → resume). */
  errorEngineEnabled: boolean
  /** Relogin attempts after a scrape failure (3–5). */
  errorEngineMaxRetries: number
  /** Base delay (ms) for exponential backoff between relogin attempts. */
  errorEngineBackoffBaseMs: number
}

export type AppSettings = QcThresholdSettings & ScrapingBehaviorSettings & ErrorEngineSettings

export const DEFAULT_APP_SETTINGS: AppSettings = {
  titleSimilarityPercent: 70,
  imageSimilarityPercent: 70,
  descriptionSimilarityPercent: 70,
  specificationSimilarityPercent: 70,
  vendorLoginRequired: true,
  reuseVendorSession: true,
  headlessScraping: false,
  errorEngineEnabled: true,
  errorEngineMaxRetries: 4,
  errorEngineBackoffBaseMs: 2000,
}

/** Sliders shown in Settings. Description and specification stay at their defaults. */
export const QC_THRESHOLD_KEYS: (keyof QcThresholdSettings)[] = [
  'titleSimilarityPercent',
  'imageSimilarityPercent',
]

export const SCRAPING_BEHAVIOR_KEYS: (keyof ScrapingBehaviorSettings)[] = [
  'vendorLoginRequired',
  'reuseVendorSession',
  'headlessScraping',
]

export const ERROR_ENGINE_KEYS: (keyof ErrorEngineSettings)[] = [
  'errorEngineEnabled',
  'errorEngineMaxRetries',
  'errorEngineBackoffBaseMs',
]
