import type { InputFieldDef } from '../data/inputFields'
import { normalizeHeader } from '../data/inputFields'

export type InputRow = Record<string, string>

const ASIN_RE = /^B[0-9A-Z]{9}$/i

/** Strip non-digits and normalize to 12-digit UPC-A (leading zero when 11 digits). */
export function normalizeUpcDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) return `0${digits}`
  if (digits.length === 12) return digits
  return null
}

/** Apply UPC normalization to every row (call after validateRows succeeds). */
export function normalizeRowsForQueue(rows: InputRow[]): InputRow[] {
  return rows.map((row) => {
    const upcRaw = (row.upc ?? '').trim()
    if (!upcRaw) return row
    const normalized = normalizeUpcDigits(upcRaw)
    if (!normalized) return row
    return { ...row, upc: normalized }
  })
}

/** Cap collected messages so huge invalid pastes don't allocate unbounded error arrays. */
const DEFAULT_MAX_ERRORS = 200

function splitLine(line: string): string[] {
  return line.split(/\t|,/).map((p) => p.trim())
}

function tryMapHeader(cells: string[], fields: InputFieldDef[]): Record<string, number> | null {
  const indexByNorm = new Map<string, number>()
  cells.forEach((cell, i) => {
    const key = normalizeHeader(cell)
    if (key) indexByNorm.set(key, i)
  })

  const mapping: Record<string, number> = {}
  for (const field of fields) {
    const idx = indexByNorm.get(normalizeHeader(field.label))
    if (idx === undefined) return null
    mapping[field.id] = idx
  }
  return mapping
}

function pushCapped(errors: string[], message: string, maxErrors: number): boolean {
  if (errors.length >= maxErrors) return false
  errors.push(message)
  return errors.length < maxErrors
}

export function parseDelimitedText(
  raw: string,
  fields: InputFieldDef[],
  options?: { maxErrors?: number },
): { rows: InputRow[]; errors: string[] } {
  const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS
  const errors: string[] = []
  if (fields.length === 0) {
    return { rows: [], errors: ['No input fields selected. Save at least one field first.'] }
  }

  const chunks = raw.split(/\r?\n/)
  const lines: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const trimmed = chunks[i].trim()
    if (trimmed.length > 0) lines.push(trimmed)
  }

  if (lines.length === 0) {
    return { rows: [], errors: ['No data rows found'] }
  }

  const expectedLabels = fields.map((f) => f.label).join(' | ')
  let startIndex = 0
  let columnMap = tryMapHeader(splitLine(lines[0]), fields)

  if (columnMap) {
    startIndex = 1
    if (lines.length === 1) {
      return { rows: [], errors: ['Header row found but no data rows'] }
    }
  } else {
    columnMap = Object.fromEntries(fields.map((f, i) => [f.id, i]))
  }

  const maxIdx = Math.max(...Object.values(columnMap))
  const rows: InputRow[] = []
  let truncated = false

  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i - startIndex + 1
    const parts = splitLine(lines[i])

    if (parts.length <= maxIdx) {
      if (!pushCapped(
        errors,
        `Row ${rowNum}: expected columns (${expectedLabels}), found ${parts.length} value(s)`,
        maxErrors,
      )) {
        truncated = true
        break
      }
      continue
    }

    const row: InputRow = {}
    for (const field of fields) {
      row[field.id] = parts[columnMap[field.id]] ?? ''
    }
    rows.push(row)
  }

  if (truncated) {
    errors.push(`… additional parse issues omitted (showing first ${maxErrors})`)
  }

  return { rows, errors }
}

export function validateRows(
  rows: InputRow[],
  fields: InputFieldDef[],
  options?: { maxErrors?: number },
): string[] {
  const maxErrors = options?.maxErrors ?? DEFAULT_MAX_ERRORS
  const errors: string[] = []
  if (fields.length === 0) {
    return ['No input fields selected. Save at least one field first.']
  }
  if (rows.length === 0) {
    return ['No valid data rows to validate']
  }

  let truncated = false

  for (let index = 0; index < rows.length; index++) {
    if (errors.length >= maxErrors) {
      truncated = true
      break
    }

    const row = rows[index]
    const rowNum = index + 1

    for (const field of fields) {
      const value = (row[field.id] ?? '').trim()
      if (!value) {
        if (!pushCapped(errors, `Row ${rowNum}: ${field.label} is empty`, maxErrors)) {
          truncated = true
          break
        }
        continue
      }
      if (field.kind === 'asin' && !ASIN_RE.test(value)) {
        if (
          !pushCapped(
            errors,
            `Row ${rowNum}: ${field.label} must match B + 9 alphanumeric characters`,
            maxErrors,
          )
        ) {
          truncated = true
          break
        }
      }
    }

    if (truncated) break
  }

  if (truncated) {
    errors.push(`… additional validation issues omitted (showing first ${maxErrors})`)
  }

  return errors
}

function asinFieldDef(fields: InputFieldDef[]): InputFieldDef | undefined {
  return fields.find((f) => f.kind === 'asin' || f.id === 'asin')
}

/** Duplicate ASINs are allowed in the paste; QC keeps the first row per ASIN only. */
export function analyzeDuplicateAsins(
  rows: InputRow[],
  fields: InputFieldDef[],
): { warnings: string[]; skippedRowNumbers: number[] } {
  const asinField = asinFieldDef(fields)
  if (!asinField) return { warnings: [], skippedRowNumbers: [] }

  const firstRowByAsin = new Map<string, number>()
  const warnings: string[] = []
  const skippedRowNumbers: number[] = []

  for (let index = 0; index < rows.length; index++) {
    const asin = (rows[index][asinField.id] ?? '').trim().toUpperCase()
    if (!asin) continue
    const rowNum = index + 1
    const firstRow = firstRowByAsin.get(asin)
    if (firstRow !== undefined) {
      warnings.push(`Row ${rowNum}: duplicate ASIN "${asin}" (same as row ${firstRow})`)
      skippedRowNumbers.push(rowNum)
    } else {
      firstRowByAsin.set(asin, rowNum)
    }
  }

  return { warnings, skippedRowNumbers }
}

/** Keep the first occurrence of each ASIN; later duplicate rows are dropped for QC. */
export function dedupeRowsByFirstAsin(rows: InputRow[], fields: InputFieldDef[]): InputRow[] {
  const asinField = asinFieldDef(fields)
  if (!asinField) return rows

  const seen = new Set<string>()
  const out: InputRow[] = []
  for (const row of rows) {
    const asin = (row[asinField.id] ?? '').trim().toUpperCase()
    if (!asin) {
      out.push(row)
      continue
    }
    if (seen.has(asin)) continue
    seen.add(asin)
    out.push(row)
  }
  return out
}

export function buildPastePlaceholder(fields: InputFieldDef[]): string {
  return fields.map((f) => f.label.replace(/\s+/g, '_')).join('\t')
}

export function buildSamplePaste(fields: InputFieldDef[]): string {
  const samples: Record<string, string[]> = {
    part_sku: ['SKU-A1', 'SKU-B2', 'SKU-C3'],
    asin: ['B08AB1CD2E', 'B08AB1CD2F', 'B08AB1CD30'],
    brand: ['Acme', 'Acme', 'Nova'],
    line: ['Pro', 'Lite', 'Pro'],
    upc: ['012345678905', '012345678912', '012345678929'],
  }
  return [0, 1, 2]
    .map((i) => fields.map((f) => samples[f.id]?.[i] ?? `VAL${i + 1}`).join('\t'))
    .join('\n')
}
