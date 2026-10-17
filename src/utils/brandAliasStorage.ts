import type { BrandAlias } from '../types/brandAlias'

export const BRAND_ALIASES_STORAGE_KEY = 'grand_qc_brand_aliases'

function newId(): string {
  return `ba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeRow(raw: Partial<BrandAlias>): BrandAlias | null {
  const amazonBrand = (raw.amazonBrand ?? '').trim()
  const vendorBrand = (raw.vendorBrand ?? '').trim()
  if (!amazonBrand || !vendorBrand) return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : newId()
  return { id, amazonBrand, vendorBrand }
}

export function normalizeBrandAliases(raw: unknown): BrandAlias[] {
  if (!Array.isArray(raw)) return []
  const out: BrandAlias[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = normalizeRow(item as Partial<BrandAlias>)
    if (!row) continue
    const key = `${row.amazonBrand}\0${row.vendorBrand}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function loadBrandAliases(): BrandAlias[] {
  try {
    const stored = localStorage.getItem(BRAND_ALIASES_STORAGE_KEY)
    if (!stored) return []
    return normalizeBrandAliases(JSON.parse(stored) as unknown)
  } catch {
    return []
  }
}

export function saveBrandAliases(aliases: BrandAlias[]): void {
  const normalized = normalizeBrandAliases(aliases)
  localStorage.setItem(BRAND_ALIASES_STORAGE_KEY, JSON.stringify(normalized))
}

export function createEmptyBrandAliasRow(): BrandAlias {
  return { id: newId(), amazonBrand: '', vendorBrand: '' }
}
