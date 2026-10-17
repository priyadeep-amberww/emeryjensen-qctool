import type { QcResult, QcVerdict } from '../types/qc'

export type ExportColumnGroup = 'meta' | 'identity' | 'comparison' | 'tokens' | 'mandatory'

export type ExportColumnDef = {
  key: string
  label: string
  group: ExportColumnGroup
  mandatory?: boolean
}

/** Canonical comparison keys used by the template QC engine (vendor tools extend this set). */
export const CANONICAL_COMPARISON_KEYS = [
  'title',
  'image',
  'price',
  'brand',
  'model',
  'pack',
  'upc',
  'description',
] as const

export const CANONICAL_IDENTITY_KEYS = [
  { key: 'sku', label: 'SKU' },
  { key: 'listing_id', label: 'ASIN' },
  { key: 'brand', label: 'Brand' },
  { key: 'reference', label: 'Reference' },
] as const

export const MANDATORY_EXPORT_COLUMN_KEYS = [
  'meta:identifier',
  'meta:verdict',
  'comparison:brand:vs',
  'comparison:title:vs',
  'comparison:model_upc:vs',
  'comparison:pack:vs',
  'comparison:price:vs',
  'comparison:image:match',
  'comparison:description:vs',
  'meta:urls',
  'meta:failReason',
  'meta:timestamp',
] as const

const MANDATORY_LABELS: Record<string, string> = {
  'meta:identifier': 'Identifier (ASIN / Vendor SKU)',
  'meta:verdict': 'VERDICT',
  'comparison:brand:vs': 'Brand Comparison (Vendor vs Amazon)',
  'comparison:title:vs': 'Title Comparison (Vendor vs Amazon)',
  'comparison:model_upc:vs': 'Model Number / UPC',
  'comparison:pack:vs': 'Pack Size / Package Quantity',
  'comparison:price:vs': 'Price Comparison (Vendor vs Amazon)',
  'comparison:image:match': 'Image Match Result',
  'comparison:description:vs': 'Description Comparison',
  'meta:urls': 'URLs (Vendor URL, Amazon URL)',
  'meta:failReason': 'Fail Reason / Errors',
  'meta:timestamp': 'Timestamp',
}

function comparisonLabels(results: QcResult[]): { source: string; target: string } {
  const withLabels = results.find((r) => r.sourceColumnLabel || r.targetColumnLabel)
  return {
    source: withLabels?.sourceColumnLabel ?? 'Vendor',
    target: withLabels?.targetColumnLabel ?? 'Amazon',
  }
}

export function buildMandatoryExportColumns(): ExportColumnDef[] {
  return MANDATORY_EXPORT_COLUMN_KEYS.map((key) => ({
    key,
    label: MANDATORY_LABELS[key] ?? key,
    group: 'mandatory',
    mandatory: true,
  }))
}

function identityValue(result: QcResult, ...keys: string[]): string {
  for (const key of keys) {
    const field = result.identity.find((f) => f.key === key)
    if (field?.value?.trim()) return field.value.trim()
  }
  return ''
}

function comparisonField(result: QcResult, key: string) {
  return result.comparisons.find((c) => c.key === key)
}

function formatVs(source: string, target: string, sourceLabel: string, targetLabel: string): string {
  const s = source?.trim() || '—'
  const t = target?.trim() || '—'
  return `${sourceLabel}: ${s} · ${targetLabel}: ${t}`
}

function extractUrl(raw: unknown, ...paths: string[]): string {
  if (!raw || typeof raw !== 'object') return ''
  const obj = raw as Record<string, unknown>
  for (const path of paths) {
    const v = obj[path]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export function verdictDisplayLabel(verdict: QcVerdict): string {
  return verdict.replace(/_/g, ' ')
}

/** Optional columns discovered from QC results (or canonical schema when empty). */
export function discoverOptionalExportColumns(results: QcResult[]): ExportColumnDef[] {
  const { source, target } = comparisonLabels(results)
  const optional: ExportColumnDef[] = [
    { key: 'meta:id', label: 'Result ID', group: 'meta' },
  ]

  const identityOrder: string[] = []
  const identityLabels = new Map<string, string>()
  const comparisonOrder: string[] = []
  const comparisonLabelsMap = new Map<string, string>()

  const rows = results.length > 0 ? results : []
  if (rows.length === 0) {
    for (const field of CANONICAL_IDENTITY_KEYS) {
      identityOrder.push(field.key)
      identityLabels.set(field.key, field.label)
    }
    for (const key of CANONICAL_COMPARISON_KEYS) {
      comparisonOrder.push(key)
      comparisonLabelsMap.set(key, key.charAt(0).toUpperCase() + key.slice(1))
    }
  } else {
    for (const row of rows) {
      for (const field of row.identity) {
        if (!identityLabels.has(field.key)) {
          identityOrder.push(field.key)
          identityLabels.set(field.key, field.label)
        }
      }
      for (const field of row.comparisons) {
        if (!comparisonLabelsMap.has(field.key)) {
          comparisonOrder.push(field.key)
          comparisonLabelsMap.set(field.key, field.label)
        }
      }
    }
  }

  for (const key of identityOrder) {
    optional.push({
      key: `identity:${key}`,
      label: identityLabels.get(key) ?? key,
      group: 'identity',
    })
  }

  for (const key of comparisonOrder) {
    const label = comparisonLabelsMap.get(key) ?? key
    optional.push({
      key: `comparison:${key}:source`,
      label: `${label} (${source})`,
      group: 'comparison',
    })
    optional.push({
      key: `comparison:${key}:target`,
      label: `${label} (${target})`,
      group: 'comparison',
    })
  }

  optional.push(
    { key: 'meta:inputTokens', label: 'Input Tokens', group: 'tokens' },
    { key: 'meta:outputTokens', label: 'Output Tokens', group: 'tokens' },
  )

  return optional
}

export function discoverExportCatalog(results: QcResult[]) {
  const mandatory = buildMandatoryExportColumns()
  const optional = discoverOptionalExportColumns(results)
  return { mandatory, optional, all: [...mandatory, ...optional] }
}

/** @deprecated Use discoverExportCatalog */
export function discoverExportColumns(results: QcResult[]): ExportColumnDef[] {
  const { all } = discoverExportCatalog(results)
  return all
}

export function defaultOptionalEnabled(optional: ExportColumnDef[]): Record<string, boolean> {
  const enabled: Record<string, boolean> = {}
  for (const col of optional) enabled[col.key] = true
  return enabled
}

export function defaultOptionalOrder(optional: ExportColumnDef[]): string[] {
  return optional.map((c) => c.key)
}

export function resolveExportColumnKeys(
  mandatory: ExportColumnDef[],
  optionalOrder: string[],
  optionalEnabled: Record<string, boolean>,
): string[] {
  const mandatoryKeys = mandatory.map((c) => c.key)
  const optionalKeys = optionalOrder.filter((key) => optionalEnabled[key])
  return [...mandatoryKeys, ...optionalKeys]
}

export function getExportCellValue(result: QcResult, columnKey: string): string {
  const { source, target } = comparisonLabels([result])

  if (columnKey === 'meta:identifier') {
    const sku = identityValue(result, 'sku', 'part_sku', 'vendor_sku')
    const asin = identityValue(result, 'listing_id', 'asin')
    if (sku && asin) return `SKU: ${sku} · ASIN: ${asin}`
    return sku || asin || result.id || '—'
  }
  if (columnKey === 'meta:verdict') {
    if (result.captureStatus) return result.captureStatus.replace(/_/g, ' ')
    if (result.verdict) return verdictDisplayLabel(result.verdict)
    return '—'
  }
  if (columnKey === 'meta:id') return result.id
  if (columnKey === 'meta:inputTokens') return String(result.inputTokens ?? 0)
  if (columnKey === 'meta:outputTokens') return String(result.outputTokens ?? 0)

  if (columnKey === 'comparison:brand:vs') {
    const field = comparisonField(result, 'brand')
    return field
      ? formatVs(field.sourceValue, field.targetValue, source, target)
      : '—'
  }
  if (columnKey === 'comparison:title:vs') {
    const field = comparisonField(result, 'title')
    return field
      ? formatVs(field.sourceValue, field.targetValue, source, target)
      : '—'
  }
  if (columnKey === 'comparison:price:vs') {
    const field = comparisonField(result, 'price')
    return field
      ? formatVs(field.sourceValue, field.targetValue, source, target)
      : '—'
  }
  if (columnKey === 'comparison:pack:vs') {
    const field = comparisonField(result, 'pack')
    return field
      ? formatVs(field.sourceValue, field.targetValue, source, target)
      : '—'
  }
  if (columnKey === 'comparison:model_upc:vs') {
    const model = comparisonField(result, 'model')
    const upc = comparisonField(result, 'upc')
    const parts: string[] = []
    if (model) parts.push(`Model — ${formatVs(model.sourceValue, model.targetValue, source, target)}`)
    if (upc) parts.push(`UPC — ${formatVs(upc.sourceValue, upc.targetValue, source, target)}`)
    return parts.length ? parts.join(' | ') : '—'
  }
  if (columnKey === 'comparison:image:match') {
    const field = comparisonField(result, 'image')
    if (!field) return '—'
    const s = field.sourceValue?.trim()
    const t = field.targetValue?.trim()
    if (!s || !t || s === '—' || t === '—') return 'No image data'
    if (s === t) return 'Match'
    return 'Mismatch'
  }
  if (columnKey === 'comparison:description:vs') {
    const field =
      comparisonField(result, 'description') ??
      comparisonField(result, 'desc') ??
      comparisonField(result, 'product_description')
    return field
      ? formatVs(field.sourceValue, field.targetValue, source, target)
      : '—'
  }
  if (columnKey === 'meta:urls') {
    const vendorUrl =
      extractUrl(result.sourceRawExtract, 'pageUrl', 'url', 'listingUrl') ||
      extractUrl(result.sourceRawExtract, 'vendorUrl')
    const amazonUrl =
      extractUrl(result.targetRawExtract, 'listingUrl', 'pageUrl', 'url') ||
      (identityValue(result, 'listing_id')
        ? `https://www.amazon.com/dp/${identityValue(result, 'listing_id')}`
        : '')
    const parts: string[] = []
    if (vendorUrl) parts.push(`Vendor: ${vendorUrl}`)
    if (amazonUrl) parts.push(`Amazon: ${amazonUrl}`)
    return parts.length ? parts.join(' · ') : '—'
  }
  if (columnKey === 'meta:failReason') {
    const errorField = comparisonField(result, 'error')
    if (errorField?.targetValue) return errorField.targetValue
    if (result.verdict !== 'FAIL' && result.verdict !== 'MANUAL_REVIEW') return '—'
    const mismatches = result.comparisons
      .filter((c) => c.key !== 'error')
      .filter((c) => {
        const s = (c.sourceValue ?? '').trim().toLowerCase()
        const t = (c.targetValue ?? '').trim().toLowerCase()
        if (!s || !t || s === '—' || t === '—') return true
        return s !== t
      })
      .map((c) => c.label)
    if (mismatches.length) return mismatches.join(', ')
    return result.verdict === 'FAIL' ? 'Verdict FAIL' : 'Manual review'
  }
  if (columnKey === 'meta:timestamp') {
    const attrs = (result.sourceRawExtract as { rawAttributes?: { lastCrawledAt?: string } })
      ?.rawAttributes?.lastCrawledAt
    if (attrs) return attrs
    return '—'
  }

  if (columnKey.startsWith('identity:')) {
    const key = columnKey.slice('identity:'.length)
    const field = result.identity.find((f) => f.key === key)
    return field?.value ?? '—'
  }

  if (columnKey.startsWith('comparison:')) {
    const rest = columnKey.slice('comparison:'.length)
    const sideSep = rest.lastIndexOf(':')
    if (sideSep === -1) return '—'
    const fieldKey = rest.slice(0, sideSep)
    const side = rest.slice(sideSep + 1)
    if (side === 'vs' || side === 'match') return '—'
    const field = result.comparisons.find((c) => c.key === fieldKey)
    if (!field) return '—'
    if (side === 'source') return field.sourceValue
    if (side === 'target') return field.targetValue
  }

  return '—'
}

export function buildExportRowValues(result: QcResult, columnKeys: string[]): string[] {
  return columnKeys.map((key) => getExportCellValue(result, key))
}

export function defaultEnabledColumnKeys(columns: ExportColumnDef[]): string[] {
  return columns.map((c) => c.key)
}
