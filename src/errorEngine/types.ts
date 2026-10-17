/** Vendor-agnostic scrape failure taxonomy for the global Error Engine. */
export type ScrapeErrorKind =
  | 'network'
  | 'timeout'
  | 'authentication'
  | 'parse'
  | 'blocked'
  | 'unknown'

export type ErrorEnginePhase =
  | 'idle'
  | 'error_detected'
  | 'paused'
  | 'cancelling_session'
  | 'relogging'
  | 'resuming'
  | 'recovered'
  | 'recovery_failed'

export type ScrapeOperationErrorDetails = {
  kind: ScrapeErrorKind
  message: string
  sku?: string
  vendorCode?: string
  retryable?: boolean
}

export class ScrapeOperationError extends Error {
  readonly kind: ScrapeErrorKind
  readonly sku?: string
  readonly vendorCode?: string
  readonly retryable: boolean

  constructor(details: ScrapeOperationErrorDetails) {
    super(details.message)
    this.name = 'ScrapeOperationError'
    this.kind = details.kind
    this.sku = details.sku
    this.vendorCode = details.vendorCode
    this.retryable = details.retryable ?? true
  }
}

export type ErrorEngineRecoveryResult =
  | { ok: true; attemptsUsed: number }
  | { ok: false; attemptsUsed: number; error: string }

export type VendorReloginResult = { ok: true } | { ok: false; error: string }

export type VendorScrapeResult =
  | { ok: true; extract?: unknown }
  | { ok: false; kind: ScrapeErrorKind; error: string }
