import { QC_CORE_COMPARISONS } from '../constants/qcCoreComparisons'
import type { QcComparisonField } from '../types/qc'
import { isEjdProductRecord } from '../types/ejdProductRecord'

export const QC_CORE_EMPTY = '—'

export type QcCoreFieldValues = {
  title: string
  brand: string
  model: string
  packVendor: string
  packAmazon: string
  upc: string
  imageVendor: string
  imageAmazon: string
}

function pickString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value).trim()
}

function orDash(value: string): string {
  const t = value.trim()
  return t ? t : QC_CORE_EMPTY
}

function amazonUpcOnly(catalogJson: unknown): string {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : null
  if (!root) return ''
  const blocks = Array.isArray((root as { identifiers?: unknown }).identifiers)
    ? (root as { identifiers: unknown[] }).identifiers
    : []
  for (const block of blocks) {
    const ids =
      block && typeof block === 'object' && Array.isArray((block as { identifiers?: unknown }).identifiers)
        ? (block as { identifiers: { identifierType?: string; identifier?: string }[] }).identifiers
        : []
    for (const id of ids) {
      if (String(id?.identifierType ?? '') === 'UPC') {
        const upc = pickString(id?.identifier)
        if (upc) return upc
      }
    }
  }
  return ''
}

function pickAmazonAttribute(attributes: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const node = attributes[key]
    if (!node) continue
    if (Array.isArray(node) && node[0] != null && typeof node[0] === 'object') {
      const v = (node[0] as { value?: unknown }).value
      if (v != null && String(v).trim()) return pickString(v)
    }
    if (typeof node === 'string') return node.trim()
  }
  return ''
}

function resolveVendorBrand(identity: Record<string, unknown> | undefined): string {
  if (!identity) return ''
  const vendor = identity.vendor as { name?: string } | undefined
  return (
    pickString(identity.brand_name) ||
    pickString(identity.manufacturer) ||
    pickString(vendor?.name)
  )
}

function resolveAmazonBrand(summary: Record<string, unknown>, attributes: Record<string, unknown>): string {
  return (
    pickString(summary.brand) ||
    pickAmazonAttribute(attributes, ['brand']) ||
    pickString(summary.manufacturer) ||
    pickAmazonAttribute(attributes, ['manufacturer'])
  )
}

function amazonMainImageUrl(catalogJson: unknown): string {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : null
  if (!root) return ''
  const blocks = Array.isArray((root as { images?: unknown }).images)
    ? (root as { images: unknown[] }).images
    : []
  for (const block of blocks) {
    const list =
      block && typeof block === 'object' && Array.isArray((block as { images?: unknown }).images)
        ? (block as { images: { variant?: string; link?: string }[] }).images
        : []
    const main = list.find((img) => img?.variant === 'MAIN')
    if (main?.link) return pickString(main.link)
  }
  return ''
}

/** Vendor-side values for the six core QC fields (EJD product record). */
export function extractVendorCoreFields(vendorExtract: unknown): QcCoreFieldValues {
  const empty: QcCoreFieldValues = {
    title: '',
    brand: '',
    model: '',
    packVendor: '',
    packAmazon: '',
    upc: '',
    imageVendor: '',
    imageAmazon: '',
  }
  if (!isEjdProductRecord(vendorExtract)) return empty

  const om = vendorExtract.commercials?.order_multiple
  const packVendor =
    om != null && Number.isFinite(Number(om)) ? String(om) : ''

  return {
    title: pickString(vendorExtract.identity.title),
    brand: resolveVendorBrand(vendorExtract.identity as Record<string, unknown>),
    model: pickString(vendorExtract.identity.mfg_part_number),
    packVendor,
    packAmazon: '',
    upc: pickString(vendorExtract.identity.upc),
    imageVendor: pickString(vendorExtract.media?.primary_image_url),
    imageAmazon: '',
  }
}

/** Amazon-side values for the six core QC fields (SP-API catalog JSON). */
export function extractAmazonCoreFields(catalogJson: unknown): QcCoreFieldValues {
  const empty: QcCoreFieldValues = {
    title: '',
    brand: '',
    model: '',
    packVendor: '',
    packAmazon: '',
    upc: '',
    imageVendor: '',
    imageAmazon: '',
  }
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : null
  if (!root) return empty

  const summaries = Array.isArray((root as { summaries?: unknown }).summaries)
    ? (root as { summaries: unknown[] }).summaries
    : []
  const summary =
    summaries[0] && typeof summaries[0] === 'object'
      ? (summaries[0] as Record<string, unknown>)
      : {}

  const attributes =
    root.attributes && typeof root.attributes === 'object'
      ? (root.attributes as Record<string, unknown>)
      : {}

  const brand = resolveAmazonBrand(summary, attributes)
  const model =
    pickString(summary.modelNumber) ||
    pickString(summary.partNumber) ||
    pickAmazonAttribute(attributes, ['model_number', 'part_number'])

  return {
    title: pickString(summary.itemName),
    brand,
    model,
    packVendor: '',
    packAmazon: '',
    upc: amazonUpcOnly(catalogJson),
    imageVendor: '',
    imageAmazon: amazonMainImageUrl(catalogJson),
  }
}

/** Six comparison rows for live SUMMARY and export (vendor = source, Amazon = target). */
export function buildQcCoreComparisons(
  vendorExtract: unknown,
  catalogJson: unknown,
): QcComparisonField[] {
  const vendor = extractVendorCoreFields(vendorExtract)
  const amazon = extractAmazonCoreFields(catalogJson)

  const valuesByKey: Record<string, { source: string; target: string }> = {
    title: { source: vendor.title, target: amazon.title },
    brand: { source: vendor.brand, target: amazon.brand },
    model: { source: vendor.model, target: amazon.model },
    pack: { source: vendor.packVendor, target: amazon.packAmazon },
    upc: { source: vendor.upc, target: amazon.upc },
    image: { source: vendor.imageVendor, target: amazon.imageAmazon },
  }

  return QC_CORE_COMPARISONS.map(({ key, label }) => {
    const pair = valuesByKey[key]
    return {
      key,
      label,
      sourceValue: orDash(pair?.source ?? ''),
      targetValue: orDash(pair?.target ?? ''),
    }
  })
}
