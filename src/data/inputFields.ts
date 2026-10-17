/** Example catalog for this QC template — vendors pick which fields apply. */
export type InputFieldKind = 'text' | 'asin' | 'upc'

export type InputFieldDef = {
  id: string
  label: string
  kind?: InputFieldKind
}

/** Available columns a vendor may enable for their QC tool. Not permanently required. */
export const AVAILABLE_INPUT_FIELDS: InputFieldDef[] = [
  { id: 'part_sku', label: 'PART SKU' },
  { id: 'asin', label: 'ASIN', kind: 'asin' },
  { id: 'brand', label: 'Brand' },
  { id: 'line', label: 'Line' },
  { id: 'upc', label: 'UPC', kind: 'upc' },
]

export const INPUT_FIELDS_STORAGE_KEY = 'qc-template-selected-input-fields'
export const SANDBOX_FIELDS_STORAGE_KEY = 'qc-template-sandbox-input-fields'

export function getFieldById(id: string): InputFieldDef | undefined {
  return AVAILABLE_INPUT_FIELDS.find((f) => f.id === id)
}

export function fieldsFromIds(ids: string[]): InputFieldDef[] {
  return ids
    .map((id) => getFieldById(id))
    .filter((f): f is InputFieldDef => Boolean(f))
}

export function loadSavedFieldIds(): string[] {
  try {
    const raw = localStorage.getItem(INPUT_FIELDS_STORAGE_KEY)
    if (!raw) return AVAILABLE_INPUT_FIELDS.map((f) => f.id)
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return AVAILABLE_INPUT_FIELDS.map((f) => f.id)
    const valid = parsed.filter(
      (id): id is string => typeof id === 'string' && Boolean(getFieldById(id)),
    )
    return valid.length > 0 ? valid : AVAILABLE_INPUT_FIELDS.map((f) => f.id)
  } catch {
    return AVAILABLE_INPUT_FIELDS.map((f) => f.id)
  }
}

export function saveFieldIds(ids: string[]): void {
  localStorage.setItem(INPUT_FIELDS_STORAGE_KEY, JSON.stringify(ids))
}

export function loadSandboxFieldIds(): string[] {
  try {
    const raw = localStorage.getItem(SANDBOX_FIELDS_STORAGE_KEY)
    if (!raw) return loadSavedFieldIds()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return loadSavedFieldIds()
    const valid = parsed.filter(
      (id): id is string => typeof id === 'string' && Boolean(getFieldById(id)),
    )
    return valid.length > 0 ? valid : loadSavedFieldIds()
  } catch {
    return loadSavedFieldIds()
  }
}

export function saveSandboxFieldIds(ids: string[]): void {
  localStorage.setItem(SANDBOX_FIELDS_STORAGE_KEY, JSON.stringify(ids))
}

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, ' ')
}
