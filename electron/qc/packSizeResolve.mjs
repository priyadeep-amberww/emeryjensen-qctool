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

function positiveInt(value) {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function firstNumber(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  const match = re.exec(String(text ?? ''))
  if (!match) return null
  return positiveInt(match[1])
}

/**
 * Retail pack count from a title.
 * Prefers an explicit pack (pk, pack, pack of) over count, then rolls.
 * Sheet counts and fluid ounces are not a pack.
 * @param {string} title
 * @returns {number | null}
 */
export function retailPackFromTitle(title) {
  const text = String(title ?? '')
  if (!text.trim()) return null

  const explicit =
    firstNumber(text, /\bpack\s+of\s+(\d+)\b/i) ??
    firstNumber(text, /\b(\d+)\s*[- ]?(?:pk|pks|packs?)\b/i)
  if (explicit != null) return explicit

  const count = firstNumber(text, /\b(\d+)\s*[- ]?(?:pcs?|pieces?|counts?|cts?)\b/i)
  if (count != null) return count

  const rollRe = /(\d+)((?:\s+[a-z]+){0,3})\s+rolls?\b/gi
  let rollMatch
  while ((rollMatch = rollRe.exec(text))) {
    if (/\bregular\b/i.test(rollMatch[2] ?? '')) continue
    const n = positiveInt(rollMatch[1])
    if (n != null) return n
  }
  return null
}

/**
 * Retail units from a vendor unit of measure such as PK/16 or 12 BX.
 * Order multiple is a case quantity and is not used here.
 * @param {string} raw
 * @returns {number | null}
 */
export function packFromUnitOfMeasure(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const unit = '(?:pk|pks|packs?|ct|cs|bx|ea|rl|rolls?)'
  const leading = text.match(new RegExp(`^${unit}\\s*[/\\-]?\\s*(\\d+)$`, 'i'))
  if (leading) return positiveInt(leading[1])
  const trailing = text.match(new RegExp(`^(\\d+)\\s*[/\\-]?\\s*${unit}$`, 'i'))
  if (trailing) return positiveInt(trailing[1])
  return null
}

/**
 * @param {unknown} vendorExtract
 */
export function extractVendorRetailPack(vendorExtract) {
  const title =
    vendorExtract?.identity?.title != null ? String(vendorExtract.identity.title) : ''
  const fromTitle = retailPackFromTitle(title)
  if (fromTitle != null) return fromTitle
  const fromUom = packFromUnitOfMeasure(vendorExtract?.logistics?.unit_of_measure)
  if (fromUom != null) return fromUom
  return 1
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
  const vendor = finitePackInt(vendorPack)
  const amazon = finitePackInt(amazonResolved.packSize)
  if (vendor != null && amazon != null && vendor === amazon) return 'MATCH'
  return 'MISMATCH'
}
