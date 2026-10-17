import type { InputRow } from '../utils/inputParse'
import type { QcComparisonField, QcIdentityField, QcVerdict } from '../types/qc'
import { DEFAULT_APP_SETTINGS, type QcThresholdSettings } from '../types/settings'
import { tokenCostUsd } from '../utils/aiPricing'
import { demoProductImageUrl } from '../utils/qcImages'
import {
  comparisonOutcomeForKey,
  exactCompareOutcome,
  type QcCompareOutcome,
  type QcComparisonOptions,
} from '../utils/qcThresholdComparison'

export type SandboxCompareOutcome = QcCompareOutcome

export type SandboxComparison = QcComparisonField & {
  outcome: SandboxCompareOutcome
}

export type SandboxAsinExtract = {
  source: 'amazon'
  asin: string
  title: string
  brand: string
  modelNumber: string
  packSize: string
  upc: string
  imageUrl: string
  listingUrl: string
  rawAttributes: Record<string, string | number | boolean | null>
}

export type SandboxVendorExtract = {
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
  rawAttributes: Record<string, string | number | boolean | null>
}

/** @deprecated Prefer asinExtract — kept as alias for older Sandbox references. */
export type SandboxFetchedListing = SandboxAsinExtract

export type SandboxQcResult = {
  identity: QcIdentityField[]
  verdict: QcVerdict
  comparisons: SandboxComparison[]
  /** Complete raw ASIN / Amazon extract */
  asinExtract: SandboxAsinExtract
  /** Complete raw vendor website extract */
  vendorExtract: SandboxVendorExtract
  /** Alias of asinExtract (legacy) */
  fetched: SandboxAsinExtract
  inputTokens: number
  outputTokens: number
  costUsd: number
  estimatedX1000Usd: number
}

function pick(row: InputRow, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key]?.trim()
    if (v) return v
  }
  return ''
}

function seedFromRow(row: InputRow): 'PASS' | 'FAIL' | 'MANUAL_REVIEW' {
  const blob = Object.values(row).join(' ').toUpperCase()
  if (blob.includes('FAIL')) return 'FAIL'
  if (blob.includes('MANUAL')) return 'MANUAL_REVIEW'
  return 'PASS'
}

function buildVendorSource(row: InputRow, seed: QcVerdict) {
  const sku = pick(row, 'part_sku') || 'SKU-UNKNOWN'
  const asin = pick(row, 'asin') || 'B08AB1CD2E'
  const brand = pick(row, 'brand') || 'Acme'
  const line = pick(row, 'line') || 'Pro'
  const upc = pick(row, 'upc') || '012345678905'

  return {
    sku,
    asin,
    brand,
    line,
    upc,
    title: `${brand} ${line} ${sku}`.trim(),
    modelNumber: sku.replace(/^SKU-?/i, '') || 'A1',
    packSize: seed === 'MANUAL_REVIEW' ? '1' : '1',
    imageUrl: demoProductImageUrl(sku, 'vendor'),
  }
}

function buildVendorExtract(
  source: ReturnType<typeof buildVendorSource>,
  seed: QcVerdict,
): SandboxVendorExtract {
  const priceUsd = seed === 'FAIL' ? 19.99 : 16.52
  return {
    source: 'vendor_website',
    sku: source.sku,
    title: source.title,
    brand: source.brand,
    line: source.line,
    modelNumber: source.modelNumber,
    packSize: source.packSize,
    upc: source.upc,
    imageUrl: source.imageUrl,
    pageUrl: `https://vendor.example.com/products/${encodeURIComponent(source.sku)}`,
    rawAttributes: {
      catalogStatus: 'Published',
      scrapeConfidence: 0.98,
      currency: 'USD',
      priceUsd,
      lastCrawledAt: '2026-09-26T06:00:00.000Z',
    },
  }
}

function formatPriceUsd(value: number): string {
  return value.toFixed(2)
}

function buildAsinExtract(
  source: ReturnType<typeof buildVendorSource>,
  seed: QcVerdict,
): SandboxAsinExtract {
  const listingUrl = `https://www.amazon.com/dp/${encodeURIComponent(source.asin)}`

  if (seed === 'FAIL') {
    return {
      source: 'amazon',
      asin: source.asin,
      title: `Different product title for ${source.sku}`,
      brand: source.brand === 'Acme' ? 'Nova' : 'OtherBrand',
      modelNumber: `${source.modelNumber}-X`,
      packSize: '2',
      upc: source.upc === '012345678905' ? '098765432109' : '111222333444',
      imageUrl: demoProductImageUrl(source.asin, 'alt'),
      listingUrl,
      rawAttributes: {
        marketplace: 'US',
        listingStatus: 'Active',
        scrapeConfidence: 0.91,
        priceUsd: 16.49,
        mismatchHint: 'title_brand_model_pack_upc',
      },
    }
  }

  if (seed === 'MANUAL_REVIEW') {
    return {
      source: 'amazon',
      asin: source.asin,
      title: `${source.brand} ${source.line} ${source.sku} (variant)`,
      brand: source.brand,
      modelNumber: `${source.modelNumber}X`,
      packSize: source.packSize,
      upc: '—',
      imageUrl: source.imageUrl,
      listingUrl,
      rawAttributes: {
        marketplace: 'US',
        listingStatus: 'Active',
        scrapeConfidence: 0.72,
        priceUsd: 16.52,
        mismatchHint: 'model_upc_soft',
      },
    }
  }

  return {
    source: 'amazon',
    asin: source.asin,
    title: `${source.brand} ${source.line}, ${source.sku}`,
    brand: source.brand,
    modelNumber: source.modelNumber,
    packSize: source.packSize,
    upc: source.upc,
    imageUrl: demoProductImageUrl(source.asin, 'amazon'),
    listingUrl,
    rawAttributes: {
      marketplace: 'US',
      listingStatus: 'Active',
      scrapeConfidence: 0.97,
      priceUsd: 16.49,
      mismatchHint: null,
    },
  }
}

function thresholdOutcome(
  key: string,
  source: string,
  target: string,
  seed: QcVerdict,
  thresholds: QcThresholdSettings,
  options?: QcComparisonOptions,
): SandboxCompareOutcome {
  if (seed === 'FAIL' && (key === 'title' || key === 'image' || key === 'price')) {
    return 'MISMATCH'
  }
  if (seed === 'MANUAL_REVIEW' && (key === 'title' || key === 'image' || key === 'price')) {
    return 'REVIEW'
  }
  return comparisonOutcomeForKey(key, source, target, thresholds, options)
}

function deriveVerdict(comparisons: SandboxComparison[], seed: QcVerdict): QcVerdict {
  if (seed === 'FAIL' || seed === 'MANUAL_REVIEW') return seed
  if (comparisons.some((c) => c.outcome === 'MISMATCH')) return 'FAIL'
  if (comparisons.some((c) => c.outcome === 'REVIEW')) return 'MANUAL_REVIEW'
  return 'PASS'
}

/** Build a deterministic demo QC result for one Sandbox SKU. */
export function buildSandboxQcResult(
  row: InputRow,
  thresholds: QcThresholdSettings = DEFAULT_APP_SETTINGS,
  options?: QcComparisonOptions,
): SandboxQcResult {
  const seed = seedFromRow(row)
  const source = buildVendorSource(row, seed)
  const vendorExtract = buildVendorExtract(source, seed)
  const asinExtract = buildAsinExtract(source, seed)
  const vendorPrice = formatPriceUsd(Number(vendorExtract.rawAttributes.priceUsd) || 0)
  const amazonPrice = formatPriceUsd(Number(asinExtract.rawAttributes.priceUsd) || 0)

  const comparisons: SandboxComparison[] = [
    {
      key: 'title',
      label: 'Title',
      sourceValue: vendorExtract.title,
      targetValue: asinExtract.title,
      outcome: thresholdOutcome(
        'title',
        vendorExtract.title,
        asinExtract.title,
        seed,
        thresholds,
        options,
      ),
    },
    {
      key: 'image',
      label: 'Image',
      sourceValue: vendorExtract.imageUrl,
      targetValue: asinExtract.imageUrl,
      outcome: thresholdOutcome(
        'image',
        vendorExtract.imageUrl,
        asinExtract.imageUrl,
        seed,
        thresholds,
        options,
      ),
    },
    {
      key: 'price',
      label: 'Price',
      sourceValue: vendorPrice,
      targetValue: amazonPrice,
      outcome: thresholdOutcome('price', vendorPrice, amazonPrice, seed, thresholds, options),
    },
    {
      key: 'brand',
      label: 'Brand',
      sourceValue: vendorExtract.brand,
      targetValue: asinExtract.brand,
      outcome: comparisonOutcomeForKey(
        'brand',
        vendorExtract.brand,
        asinExtract.brand,
        thresholds,
        options,
      ),
    },
    {
      key: 'model',
      label: 'Model Number',
      sourceValue: vendorExtract.modelNumber,
      targetValue: asinExtract.modelNumber,
      outcome: exactCompareOutcome(vendorExtract.modelNumber, asinExtract.modelNumber),
    },
    {
      key: 'pack',
      label: 'Pack Size',
      sourceValue: vendorExtract.packSize,
      targetValue: asinExtract.packSize,
      outcome: exactCompareOutcome(vendorExtract.packSize, asinExtract.packSize),
    },
    {
      key: 'upc',
      label: 'UPC',
      sourceValue: vendorExtract.upc,
      targetValue: asinExtract.upc,
      outcome: exactCompareOutcome(vendorExtract.upc, asinExtract.upc),
    },
  ]

  const inputTokens = 380 + (source.sku.length % 7) * 18
  const outputTokens = 10 + (source.asin.length % 5) * 2
  const costUsd = tokenCostUsd(inputTokens, outputTokens)

  return {
    identity: [
      { key: 'sku', label: 'SKU', value: source.sku },
      { key: 'listing_id', label: 'ASIN', value: source.asin },
      { key: 'brand', label: 'Brand', value: source.brand },
    ],
    verdict: deriveVerdict(comparisons, seed),
    comparisons,
    asinExtract,
    vendorExtract,
    fetched: asinExtract,
    inputTokens,
    outputTokens,
    costUsd,
    estimatedX1000Usd: costUsd * 1000,
  }
}

export type SandboxTerminalLine = {
  id: string
  at: number
  level: 'SYSTEM' | 'SCRAPING' | 'AI' | 'QC' | 'ERROR' | 'WARNING' | 'INFO'
  text: string
}

/** Timed steps for the Sandbox terminal live output. */
export function buildSandboxTerminalScript(
  row: InputRow,
  result: SandboxQcResult,
  options?: { headlessScraping?: boolean },
): Array<{ delayMs: number; level: SandboxTerminalLine['level']; text: string }> {
  const headless = options?.headlessScraping ?? true
  const sku =
    result.identity.find((f) => f.key === 'sku')?.value ||
    pick(row, 'part_sku') ||
    'SKU'
  const asin =
    result.identity.find((f) => f.key === 'listing_id')?.value ||
    pick(row, 'asin') ||
    '—'
  const verdictLabel = result.verdict.replace(/_/g, ' ')

  return [
    {
      delayMs: 0,
      level: 'SYSTEM',
      text: `Sandbox QC session opened · 1 SKU${headless ? '' : ' · visible browser'}`,
    },
    { delayMs: 280, level: 'INFO', text: `Input row accepted · ${sku}` },
    { delayMs: 520, level: 'SCRAPING', text: `Fetching vendor website extract for ${sku}…` },
    { delayMs: 820, level: 'SCRAPING', text: `Vendor extract ready · ${Object.keys(result.vendorExtract).length} top-level fields` },
    { delayMs: 1100, level: 'SCRAPING', text: `Resolving Amazon listing ${asin}…` },
    { delayMs: 1450, level: 'SCRAPING', text: `ASIN extract ready · ${Object.keys(result.asinExtract).length} top-level fields` },
    {
      delayMs: 1650,
      level: 'AI',
      text: `Preparing comparison context · Title / Image / Price / Brand / Model / Pack / UPC`,
    },
    {
      delayMs: 2050,
      level: 'AI',
      text: `Model call complete · ${result.inputTokens} in / ${result.outputTokens} out`,
    },
    ...result.comparisons.map((c, i) => ({
      delayMs: 2300 + i * 220,
      level: (c.outcome === 'MISMATCH' ? 'ERROR' : c.outcome === 'REVIEW' ? 'WARNING' : 'QC') as SandboxTerminalLine['level'],
      text: `${c.label}: ${c.outcome} · source="${c.sourceValue}" · target="${c.targetValue}"`,
    })),
    {
      delayMs: 2300 + result.comparisons.length * 220 + 200,
      level:
        result.verdict === 'FAIL'
          ? 'ERROR'
          : result.verdict === 'MANUAL_REVIEW'
            ? 'WARNING'
            : 'QC',
      text: `Final verdict → ${verdictLabel}`,
    },
    {
      delayMs: 2300 + result.comparisons.length * 220 + 450,
      level: 'SYSTEM',
      text: `Sandbox QC finished · cost $${result.costUsd.toFixed(4)} · ×1000 ≈ $${result.estimatedX1000Usd.toFixed(2)}`,
    },
  ]
}
