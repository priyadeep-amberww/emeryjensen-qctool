/**
 * @param {string} asin
 * @param {string} marketplaceId
 * @param {unknown} catalogJson
 */
export function normalizeAmazonListing(asin, marketplaceId, catalogJson) {
  const listingUrl = `https://www.amazon.com/dp/${encodeURIComponent(asin)}`
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}

  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = summaries.find((s) => s?.marketplaceId === marketplaceId) ?? summaries[0] ?? {}

  const attributes = root.attributes && typeof root.attributes === 'object' ? root.attributes : {}
  const title = pickString(summary.itemName) || pickString(summary.brand) || asin
  const brand =
    pickString(summary.brand) ||
    pickAttribute(attributes, ['brand']) ||
    pickString(summary.manufacturer) ||
    pickAttribute(attributes, ['manufacturer']) ||
    '—'

  const images = Array.isArray(root.images) ? root.images : []
  const imageBlock = images.find((i) => i?.marketplaceId === marketplaceId) ?? images[0]
  const imageList = imageBlock?.images ?? []
  const mainImage = imageList.find((img) => img?.variant === 'MAIN') ?? imageList[0]
  const imageUrl = pickString(mainImage?.link) || ''

  const identifiers = Array.isArray(root.identifiers) ? root.identifiers : []
  const idBlock = identifiers.find((i) => i?.marketplaceId === marketplaceId) ?? identifiers[0]
  const idList = idBlock?.identifiers ?? []
  const upc =
    pickIdentifier(idList, 'UPC') ||
    pickIdentifier(idList, 'EAN') ||
    pickIdentifier(idList, 'GTIN') ||
    '—'

  const modelNumber =
    pickString(summary.modelNumber) ||
    pickString(summary.partNumber) ||
    pickAttribute(attributes, ['model_number', 'part_number', 'manufacturer_part_number'])
  const packSize = pickAttribute(attributes, ['number_of_items', 'item_package_quantity']) || '1'
  const priceUsd = pickPriceUsd(attributes, summary)

  return {
    source: 'amazon',
    asin,
    title,
    brand,
    modelNumber: modelNumber || '—',
    packSize,
    upc,
    imageUrl,
    listingUrl,
    marketplace: marketplaceId,
    rawAttributes: {
      marketplaceId,
      listingStatus: pickString(summary.status) || 'Unknown',
      priceUsd,
      spApi: root,
    },
  }
}

function pickPriceUsd(attributes, summary) {
  const fromAttr = pickAttribute(attributes, ['list_price', 'buying_price', 'our_price'])
  if (fromAttr) {
    const n = Number.parseFloat(fromAttr.replace(/[^0-9.-]+/g, ''))
    if (Number.isFinite(n)) return n
  }
  return 0
}

function pickString(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed
}

function pickIdentifier(list, type) {
  if (!Array.isArray(list)) return ''
  const found = list.find((entry) => entry?.identifierType === type)
  return pickString(found?.identifier)
}

function pickAttribute(attributes, keys) {
  for (const key of keys) {
    const node = attributes[key]
    if (!node) continue
    if (Array.isArray(node) && node[0]?.value != null) {
      return String(node[0].value).trim()
    }
    if (typeof node === 'string') return node.trim()
  }
  return ''
}
