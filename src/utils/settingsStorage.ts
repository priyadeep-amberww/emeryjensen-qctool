import {
  DEFAULT_APP_SETTINGS,
  ERROR_ENGINE_BACKOFF_MAX_MS,
  ERROR_ENGINE_BACKOFF_MIN_MS,
  ERROR_ENGINE_RETRY_MAX,
  ERROR_ENGINE_RETRY_MIN,
  QC_SIMILARITY_THRESHOLD_MAX,
  QC_SIMILARITY_THRESHOLD_MIN,
  type AppSettings,
  type ErrorEngineSettings,
  type QcThresholdSettings,
  type ScrapingBehaviorSettings,
} from '../types/settings'

export const APP_SETTINGS_STORAGE_KEY = 'grand_qc_app_settings'

export function clampSimilarityThresholdPercent(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(
    QC_SIMILARITY_THRESHOLD_MAX,
    Math.max(QC_SIMILARITY_THRESHOLD_MIN, Math.round(n)),
  )
}

function clampBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function normalizeThresholds(raw: Partial<QcThresholdSettings>): QcThresholdSettings {
  return {
    titleSimilarityPercent: clampSimilarityThresholdPercent(
      raw.titleSimilarityPercent,
      DEFAULT_APP_SETTINGS.titleSimilarityPercent,
    ),
    imageSimilarityPercent: clampSimilarityThresholdPercent(
      raw.imageSimilarityPercent,
      DEFAULT_APP_SETTINGS.imageSimilarityPercent,
    ),
    descriptionSimilarityPercent: clampSimilarityThresholdPercent(
      raw.descriptionSimilarityPercent,
      DEFAULT_APP_SETTINGS.descriptionSimilarityPercent,
    ),
    specificationSimilarityPercent: clampSimilarityThresholdPercent(
      raw.specificationSimilarityPercent,
      DEFAULT_APP_SETTINGS.specificationSimilarityPercent,
    ),
  }
}

function normalizeBehavior(raw: Partial<ScrapingBehaviorSettings>): ScrapingBehaviorSettings {
  return {
    vendorLoginRequired: clampBool(
      raw.vendorLoginRequired,
      DEFAULT_APP_SETTINGS.vendorLoginRequired,
    ),
    reuseVendorSession: clampBool(raw.reuseVendorSession, DEFAULT_APP_SETTINGS.reuseVendorSession),
    headlessScraping: clampBool(raw.headlessScraping, DEFAULT_APP_SETTINGS.headlessScraping),
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeErrorEngine(raw: Partial<ErrorEngineSettings>): ErrorEngineSettings {
  return {
    errorEngineEnabled: clampBool(raw.errorEngineEnabled, DEFAULT_APP_SETTINGS.errorEngineEnabled),
    errorEngineMaxRetries: clampInt(
      raw.errorEngineMaxRetries,
      DEFAULT_APP_SETTINGS.errorEngineMaxRetries,
      ERROR_ENGINE_RETRY_MIN,
      ERROR_ENGINE_RETRY_MAX,
    ),
    errorEngineBackoffBaseMs: clampInt(
      raw.errorEngineBackoffBaseMs,
      DEFAULT_APP_SETTINGS.errorEngineBackoffBaseMs,
      ERROR_ENGINE_BACKOFF_MIN_MS,
      ERROR_ENGINE_BACKOFF_MAX_MS,
    ),
  }
}

export function normalizeAppSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  if (!raw) return { ...DEFAULT_APP_SETTINGS }
  return {
    ...normalizeThresholds(raw),
    ...normalizeBehavior(raw),
    ...normalizeErrorEngine(raw),
  }
}

export function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_APP_SETTINGS }
    const parsed = JSON.parse(stored) as Partial<AppSettings>
    return normalizeAppSettings(parsed)
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export function saveAppSettings(settings: AppSettings): void {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
