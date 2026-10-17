import type { BrandAliasPair } from '../types/brandAlias'
import type { QcComparisonField } from '../types/qc'
import type { AppSettings, QcThresholdSettings } from '../types/settings'
import type { QcResult, QcVerdict } from '../types/qc'
import { isBrandAliasMatch } from './brandAliasMatch'
import { brandNamesMatchForCompare } from './qcBrandCompare'
import { modelCompareOutcome } from './qcModelCompare'

export type QcComparisonOptions = {
  brandAliases?: readonly BrandAliasPair[]
}

export type QcCompareOutcome = 'MATCH' | 'MISMATCH' | 'REVIEW'

/** Fixed price tolerance in QC comparisons (not exposed in Settings). */
const DEFAULT_PRICE_VARIANCE_PERCENT = 15

export function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenSet(value: string): string[] {
  return normalizeLoose(value).split(' ').filter(Boolean)
}

/** 0–100 similarity based on shared tokens vs the longer token list. */
export function titleSimilarityPercent(source: string, target: string): number {
  const a = tokenSet(source)
  const b = tokenSet(target)
  if (a.length === 0 && b.length === 0) return 100
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const matches = a.filter((w) => setB.has(w)).length
  return Math.round((matches / Math.max(a.length, b.length)) * 100)
}

function picsumSeed(url: string): string {
  const match = url.match(/\/seed\/([^/]+)\//)
  return match ? decodeURIComponent(match[1]) : url
}

/** Demo-friendly image similarity from URL seeds (0–100). */
export function imageSimilarityPercent(sourceUrl: string, targetUrl: string): number {
  if (!sourceUrl || !targetUrl) return 0
  if (sourceUrl === targetUrl) return 100
  return titleSimilarityPercent(picsumSeed(sourceUrl), picsumSeed(targetUrl))
}

/** Absolute percent difference between two prices (0–100+). */
export function priceVariancePercent(source: string, target: string): number {
  const parse = (value: string) => {
    const n = Number.parseFloat(value.replace(/[^0-9.-]+/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const s = parse(source)
  const t = parse(target)
  if (s === null || t === null) return 100
  if (s === 0 && t === 0) return 0
  const base = Math.max(Math.abs(s), Math.abs(t))
  if (base === 0) return 0
  return Math.round((Math.abs(s - t) / base) * 100)
}

export function exactCompareOutcome(source: string, target: string): QcCompareOutcome {
  if (!source || source === '—' || !target || target === '—') return 'REVIEW'
  return normalizeLoose(source) === normalizeLoose(target) ? 'MATCH' : 'MISMATCH'
}

export function comparisonOutcomeForKey(
  key: string,
  sourceValue: string,
  targetValue: string,
  thresholds: QcThresholdSettings,
  options?: QcComparisonOptions,
  field?: Pick<QcComparisonField, 'outcome' | 'scorePercent'>,
): QcCompareOutcome {
  if (
    field?.outcome === 'MATCH' ||
    field?.outcome === 'MISMATCH' ||
    field?.outcome === 'REVIEW'
  ) {
    return field.outcome
  }

  switch (key) {
    case 'title': {
      if (field?.scorePercent != null) {
        return field.scorePercent >= thresholds.titleSimilarityPercent ? 'MATCH' : 'MISMATCH'
      }
      return 'REVIEW'
    }
    case 'image': {
      if (field?.scorePercent != null) {
        return field.scorePercent >= thresholds.imageSimilarityPercent ? 'MATCH' : 'MISMATCH'
      }
      const sim = imageSimilarityPercent(sourceValue, targetValue)
      return sim >= thresholds.imageSimilarityPercent ? 'MATCH' : 'MISMATCH'
    }
    case 'description': {
      const sim = titleSimilarityPercent(sourceValue, targetValue)
      if (!sourceValue || !targetValue || sourceValue === '—' || targetValue === '—') {
        return 'REVIEW'
      }
      return sim >= thresholds.descriptionSimilarityPercent ? 'MATCH' : 'MISMATCH'
    }
    case 'specifications': {
      const sim = titleSimilarityPercent(sourceValue, targetValue)
      if (!sourceValue || !targetValue || sourceValue === '—' || targetValue === '—') {
        return 'REVIEW'
      }
      return sim >= thresholds.specificationSimilarityPercent ? 'MATCH' : 'MISMATCH'
    }
    case 'price': {
      const variance = priceVariancePercent(sourceValue, targetValue)
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT) return 'MATCH'
      if (variance <= DEFAULT_PRICE_VARIANCE_PERCENT + 10) return 'REVIEW'
      return 'MISMATCH'
    }
    case 'brand': {
      const s = sourceValue.trim()
      const t = targetValue.trim()
      if (!s || !t || s === '—' || t === '—') return 'REVIEW'
      const aliases = options?.brandAliases
      if (aliases?.length && isBrandAliasMatch(sourceValue, targetValue, aliases)) {
        return 'MATCH'
      }
      return brandNamesMatchForCompare(sourceValue, targetValue) ? 'MATCH' : 'MISMATCH'
    }
    case 'model':
      return modelCompareOutcome(sourceValue, targetValue)
    case 'pack':
      return exactCompareOutcome(sourceValue, targetValue)
    default:
      return exactCompareOutcome(sourceValue, targetValue)
  }
}

export function deriveVerdictFromComparisons(
  comparisons: QcComparisonField[],
  thresholds: QcThresholdSettings,
  options?: QcComparisonOptions,
): QcVerdict {
  let hasMismatch = false
  let hasReview = false
  for (const field of comparisons) {
    const outcome = comparisonOutcomeForKey(
      field.key,
      field.sourceValue,
      field.targetValue,
      thresholds,
      options,
      field,
    )
    if (outcome === 'MISMATCH') hasMismatch = true
    if (outcome === 'REVIEW') hasReview = true
  }
  if (hasMismatch) return 'FAIL'
  if (hasReview) return 'MANUAL_REVIEW'
  return 'PASS'
}

/** Apply shared QC thresholds to a finished result (batch demo / live QC). */
export function applyQcThresholdsToResult(
  result: QcResult,
  thresholds: Pick<AppSettings, keyof QcThresholdSettings>,
  options?: QcComparisonOptions,
): QcResult {
  if (result.verdict && result.captureStatus) return result
  const verdict = deriveVerdictFromComparisons(result.comparisons, thresholds, options)
  if (verdict === result.verdict) return result
  return { ...result, verdict }
}
