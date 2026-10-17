export type {
  ErrorEnginePhase,
  ErrorEngineRecoveryResult,
  ScrapeErrorKind,
  ScrapeOperationErrorDetails,
  VendorReloginResult,
  VendorScrapeResult,
} from './types'
export { ScrapeOperationError } from './types'
export { exponentialBackoffMs, sleep } from './backoff'
export { runErrorEngineRecovery, type VendorSessionPort } from './recoveryOrchestrator'
export { templateScrapeFailureFromRow } from './templateScrapeMarkers'
