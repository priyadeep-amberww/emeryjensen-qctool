const EXCLUDED_SPEC_KEYS = new Set([
  'title_differentiation',
  'pesticide_marking',
  'california_proposition_65',
  'batteries_included',
  'batteries_required',
  'skip_offer',
  'variation_theme',
  'gpsr_safety_attestation',
  'supplier_declared_dg_hz_regulation',
  'fcc_radio_frequency_emission_compliance',
  'product_site_launch_date',
  'externally_assigned_product_identifier',
])

const PLACEHOLDER_VALUES = new Set([
  'shape',
  'no size',
  'one size',
  'warranty',
  'unscented',
  'unknown',
  'not_applicable',
  'all',
])

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

function isJsonBlob(value) {
  const s = String(value ?? '').trim()
  return s.startsWith('{') && s.includes('"language_tag"')
}

function isJunkAttributeValue(key, value) {
  const s = String(value ?? '').trim()
  if (!s) return true
  if (isJsonBlob(s)) return true
  const lower = s.toLowerCase()
  if (PLACEHOLDER_VALUES.has(lower)) return true
  if (key === 'scent' && lower === 'unscented') return false
  if (lower === 'unscented') return true
  if (/\bmonth\b/i.test(s) && /thickness|wall/i.test(String(key))) return true
  if (lower === 'exact upc searched; original product details preserved') return true
  if (lower.includes('exact upc searched')) return true
  return false
}

export function shouldIncludeAmazonSpecKey(key) {
  return !EXCLUDED_SPEC_KEYS.has(String(key))
}

export function filterAmazonAttributeValue(key, value) {
  if (!shouldIncludeAmazonSpecKey(key)) return null
  if (isJunkAttributeValue(key, value)) return null
  return String(value).trim()
}

/**
 * @param {Record<string, unknown>} attributes
 * @returns {string[]}
 */
export function flattenFilteredAmazonAttributes(attributes) {
  const lines = []
  if (!attributes || typeof attributes !== 'object') return lines
  for (const [key, node] of Object.entries(attributes)) {
    if (!shouldIncludeAmazonSpecKey(key)) continue
    if (node == null) continue
    if (Array.isArray(node)) {
      const values = []
      for (const entry of node) {
        const raw = pickAttrValue(entry)
        const filtered = filterAmazonAttributeValue(key, raw)
        if (filtered) values.push(filtered)
      }
      if (values.length) lines.push(`${key}: ${values.join('; ')}`)
      continue
    }
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      const filtered = filterAmazonAttributeValue(key, node)
      if (filtered) lines.push(`${key}: ${filtered}`)
    }
  }
  return lines.sort((a, b) => a.localeCompare(b))
}

/**
 * @param {Record<string, unknown>} attributes
 * @returns {string[]}
 */
export function filteredBulletPoints(attributes) {
  const bullets = attributes?.bullet_point
  if (!Array.isArray(bullets)) return []
  const out = []
  for (const entry of bullets) {
    const raw = pickAttrValue(entry)
    const filtered = filterAmazonAttributeValue('bullet_point', raw)
    if (filtered) out.push(filtered)
  }
  return out
}
