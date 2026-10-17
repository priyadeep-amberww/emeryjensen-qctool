import { extractVendorRetailPack } from './packSizeResolve.mjs'

export const QC_CORE_EMPTY = '—'

const QC_CORE_COMPARISONS = [
  { key: 'title', label: 'TITLE' },
  { key: 'brand', label: 'BRAND-NAME' },
  { key: 'pack', label: 'PACK-SIZE' },
  { key: 'model', label: 'MODEL-NUMBER' },
  { key: 'upc', label: 'UPC' },
  { key: 'image', label: 'IMAGE' },
]

function pickString(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value).trim()
}

function orDash(value) {
  const t = String(value ?? '').trim()
  return t ? t : QC_CORE_EMPTY
}

function isEjdProductRecord(raw) {
  return Boolean(raw && typeof raw === 'object' && raw.identity?.ejd_sku)
}

function amazonUpcOnly(catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : null
  if (!root) return ''
  const blocks = Array.isArray(root.identifiers) ? root.identifiers : []
  for (const block of blocks) {
    const ids = block?.identifiers ?? []
    for (const id of ids) {
      if (String(id?.identifierType ?? '') === 'UPC') {
        const upc = pickString(id?.identifier)
        if (upc) return upc
      }
    }
  }
  return ''
}

export function resolveVendorBrand(identity) {
  if (!identity || typeof identity !== 'object') return ''
  return (
    pickString(identity.brand_name) ||
    pickString(identity.manufacturer) ||
    pickString(identity.vendor?.name)
  )
}

export function resolveAmazonBrand(summary, attributes) {
  const s = summary && typeof summary === 'object' ? summary : {}
  return (
    pickString(s.brand) ||
    pickAmazonAttribute(attributes, ['brand']) ||
    pickString(s.manufacturer) ||
    pickAmazonAttribute(attributes, ['manufacturer'])
  )
}

function pickAmazonAttribute(attributes, keys) {
  if (!attributes || typeof attributes !== 'object') return ''
  for (const key of keys) {
    const node = attributes[key]
    if (!node) continue
    if (Array.isArray(node) && node[0] != null && typeof node[0] === 'object') {
      const v = node[0].value
      if (v != null && String(v).trim()) return pickString(v)
    }
    if (typeof node === 'string') return node.trim()
  }
  return ''
}

function amazonMainImageUrl(catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : null
  if (!root) return ''
  const blocks = Array.isArray(root.images) ? root.images : []
  for (const block of blocks) {
    const list = block?.images ?? []
    const main = list.find((img) => img?.variant === 'MAIN')
    if (main?.link) return pickString(main.link)
  }
  return ''
}

export function extractVendorCoreFields(vendorExtract) {
  const empty = {
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

  const packVendor = String(extractVendorRetailPack(vendorExtract))

  return {
    title: pickString(vendorExtract.identity?.title),
    brand: resolveVendorBrand(vendorExtract.identity),
    model: pickString(vendorExtract.identity?.mfg_part_number),
    packVendor,
    packAmazon: '',
    upc: pickString(vendorExtract.identity?.upc),
    imageVendor: pickString(vendorExtract.media?.primary_image_url),
    imageAmazon: '',
  }
}

export function extractAmazonCoreFields(catalogJson) {
  const empty = {
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

  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = summaries[0] && typeof summaries[0] === 'object' ? summaries[0] : {}
  const attributes =
    root.attributes && typeof root.attributes === 'object' ? root.attributes : {}

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

export function buildQcCoreComparisons(vendorExtract, catalogJson) {
  const vendor = extractVendorCoreFields(vendorExtract)
  const amazon = extractAmazonCoreFields(catalogJson)

  const valuesByKey = {
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
