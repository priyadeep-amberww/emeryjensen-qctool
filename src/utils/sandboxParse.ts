import type { InputFieldDef } from '../data/inputFields'
import { normalizeHeader } from '../data/inputFields'
import type { InputRow } from './inputParse'

const ASIN_RE = /^B[0-9A-Z]{9}$/i
const UPC_RE = /^\d{8,14}$/

function splitCells(line: string): string[] {
  return line.split(/\t|,/).map((p) => p.trim())
}

/** True when the first line looks like column headers rather than values. */
export function looksLikeHeaderRow(cells: string[], fields: InputFieldDef[]): boolean {
  if (fields.length === 0 || cells.length === 0) return false
  const cellNorms = cells.map((c) => normalizeHeader(c))
  let hits = 0
  for (const field of fields) {
    const labelNorm = normalizeHeader(field.label)
    const idNorm = normalizeHeader(field.id)
    if (cellNorms.some((c) => c === labelNorm || c === idNorm)) hits++
  }
  // Majority of configured columns matched as labels → treat as a header row.
  return hits >= Math.ceil(fields.length / 2) && hits >= 1
}

/**
 * Parse Sandbox paste: values only, exactly one data row.
 * Column order is defined by `fields`; headers are rejected.
 */
export function parseSandboxValuesOnly(
  raw: string,
  fields: InputFieldDef[],
): { row: InputRow | null; errors: string[] } {
  const errors: string[] = []

  if (fields.length === 0) {
    return { row: null, errors: ['Configure and save columns before running Sandbox QC'] }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    return { row: null, errors: ['Paste exactly one row of values (no column headers)'] }
  }

  if (lines.length > 1) {
    return {
      row: null,
      errors: [
        `Sandbox accepts exactly 1 SKU / 1 row only. Found ${lines.length} non-empty lines.`,
      ],
    }
  }

  const cells = splitCells(lines[0])
  while (cells.length > fields.length && cells[cells.length - 1] === '') {
    cells.pop()
  }

  if (looksLikeHeaderRow(cells, fields)) {
    return {
      row: null,
      errors: [
        'Headers are not accepted. Paste values only — column order comes from the Column Configurator.',
      ],
    }
  }

  if (cells.length < fields.length) {
    const expected = fields.map((f) => f.label).join(' | ')
    return {
      row: null,
      errors: [
        `Expected ${fields.length} value(s) in order (${expected}), found ${cells.length}`,
      ],
    }
  }

  if (cells.length > fields.length) {
    return {
      row: null,
      errors: [
        `Too many values: expected ${fields.length} (one per configured column), found ${cells.length}`,
      ],
    }
  }

  const row: InputRow = {}
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const value = cells[i] ?? ''
    if (!value.trim()) {
      errors.push(`${field.label} is empty`)
      continue
    }
    if (field.kind === 'asin' && !ASIN_RE.test(value)) {
      errors.push(`${field.label} must match B + 9 alphanumeric characters`)
    }
    if (field.kind === 'upc' && !UPC_RE.test(value)) {
      errors.push(`${field.label} must be 8–14 digits`)
    }
    row[field.id] = value.trim()
  }

  if (errors.length > 0) return { row: null, errors }
  return { row, errors: [] }
}

export function buildSandboxSampleValues(fields: InputFieldDef[]): string {
  const samples: Record<string, string> = {
    part_sku: 'SKU-A1',
    asin: 'B08AB1CD2E',
    brand: 'Acme',
    line: 'Pro',
    upc: '012345678905',
  }
  return fields.map((f) => samples[f.id] ?? 'VALUE').join('\t')
}

export function buildSandboxValuesPlaceholder(fields: InputFieldDef[]): string {
  return fields.map((f) => `<${f.label.replace(/\s+/g, '_')}>`).join('\t')
}
