/** Mirrors `src/data/inputFields.ts` — keep in sync for main-process validation. */
export const AVAILABLE_INPUT_FIELDS = [
  { id: 'part_sku', label: 'PART SKU' },
  { id: 'asin', label: 'ASIN', kind: 'asin' },
  { id: 'brand', label: 'Brand' },
  { id: 'line', label: 'Line' },
  { id: 'upc', label: 'UPC', kind: 'upc' },
]

export function getFieldById(id) {
  return AVAILABLE_INPUT_FIELDS.find((f) => f.id === id)
}

export function fieldsFromIds(ids) {
  return ids.map((id) => getFieldById(id)).filter(Boolean)
}

export function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, ' ')
}
