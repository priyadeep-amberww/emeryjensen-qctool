function pickAttrValue(node) {
  if (node == null) return null
  if (Array.isArray(node)) {
    for (const entry of node) {
      if (entry && typeof entry === 'object' && 'value' in entry) {
        const v = entry.value
        if (v != null && String(v).trim()) return v
      }
    }
    return null
  }
  if (typeof node === 'object' && 'value' in node) return node.value
  return node
}

/**
 * Retail pack count from listing title (e.g. "22 pk", "1 pack").
 * @param {string} title
 * @returns {number | null}
 */
export function retailPackFromTitle(title) {
  const m = String(title ?? '').match(/(\d+)\s*(?:pk|pack|pks|pcs?|pieces?|count)\b/i)
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {unknown} vendorExtract
 */
export function extractVendorRetailPack(vendorExtract) {
  const title =
    vendorExtract?.identity?.title != null ? String(vendorExtract.identity.title) : ''
  const fromTitle = retailPackFromTitle(title)
  return fromTitle ?? 1
}

function finitePackInt(value) {
  if (value == null) return null
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * @param {unknown} catalogJson
 * @returns {{ packSize: number, titlePack: number | null, conflictNote: string, signalSummary: string }}
 */
export function resolveAmazonRetailPack(catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}
  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = summaries[0] && typeof summaries[0] === 'object' ? summaries[0] : {}
  const attributes =
    root.attributes && typeof root.attributes === 'object' ? root.attributes : {}

  const title = pickAttrValue(attributes.item_name) ?? summary.itemName ?? ''
  const titlePack = retailPackFromTitle(title)

  const signals = {}
  const pq = finitePackInt(summary.packageQuantity)
  if (pq != null) signals.packageQuantity = pq
  const noi = finitePackInt(pickAttrValue(attributes.number_of_items))
  if (noi != null) signals.numberOfItems = noi
  const uc = finitePackInt(pickAttrValue(attributes.unit_count))
  if (uc != null) signals.unitCount = uc
  const ipq = finitePackInt(pickAttrValue(attributes.item_package_quantity))
  if (ipq != null) signals.item_package_quantity = ipq

  const values = [...new Set(Object.values(signals))]
  const signalSummary = Object.entries(signals)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')

  let conflictNote = ''
  let packSize = 1

  if (titlePack != null) {
    packSize = titlePack
    const mismatched = Object.entries(signals).filter(([, v]) => v !== titlePack)
    if (mismatched.length) {
      conflictNote = `Amazon pack conflict: title ${titlePack}, ${mismatched
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`
    }
  } else if (values.length === 1) {
    packSize = values[0]
  } else if (values.length > 1) {
    packSize = Math.min(...values)
    conflictNote = `Amazon pack conflict: ${signalSummary}`
  } else {
    packSize = 1
  }

  return { packSize, titlePack, conflictNote, signalSummary }
}

/**
 * @param {number} vendorPack
 * @param {{ packSize: number, titlePack: number | null, conflictNote: string }} amazonResolved
 */
export function derivePackCompareOutcome(vendorPack, amazonResolved) {
  const vendor = finitePackInt(vendorPack) ?? vendorPack
  const amazon = amazonResolved.packSize
  if (!amazonResolved.conflictNote) {
    return vendor === amazon ? 'MATCH' : 'MISMATCH'
  }
  if (amazonResolved.titlePack != null && amazonResolved.titlePack === vendor) {
    return 'MATCH'
  }
  if (vendor === amazon) {
    return 'REVIEW'
  }
  return 'REVIEW'
}
