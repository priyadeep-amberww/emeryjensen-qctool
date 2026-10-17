import { AVAILABLE_INPUT_FIELDS, fieldsFromIds, normalizeHeader } from './qcFieldCatalog.mjs'

export const QC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const QC_UPLOAD_MAX_ROWS = 15000
export const QC_VALIDATE_PREVIEW_ROWS = 100
const ALLOWED_FILE_EXTENSIONS = new Set(['.csv', '.txt', '.tsv'])
const ASIN_RE = /^B[0-9A-Z]{9}$/i
const UPC_DIGITS_RE = /^\d{11,12}$/

function normalizeUpcDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 11) return `0${digits}`
  if (digits.length === 12) return digits
  return null
}

function normalizeRowsForQueue(rows) {
  return rows.map((row) => {
    const upcRaw = (row.upc ?? '').trim()
    if (!upcRaw) return row
    const normalized = normalizeUpcDigits(upcRaw)
    if (!normalized) return row
    return { ...row, upc: normalized }
  })
}
const DEFAULT_MAX_ERRORS = 200

function splitLine(line) {
  return line.split(/\t|,/).map((p) => p.trim())
}

function tryMapHeader(cells, fields) {
  const indexByNorm = new Map()
  cells.forEach((cell, i) => {
    const key = normalizeHeader(cell)
    if (key) indexByNorm.set(key, i)
  })
  const mapping = {}
  for (const field of fields) {
    const idx = indexByNorm.get(normalizeHeader(field.label))
    if (idx === undefined) return null
    mapping[field.id] = idx
  }
  return mapping
}

function pushCapped(errors, message, maxErrors) {
  if (errors.length >= maxErrors) return false
  errors.push(message)
  return errors.length < maxErrors
}

function parseDelimitedText(raw, fields, maxErrors = DEFAULT_MAX_ERRORS) {
  const errors = []
  if (fields.length === 0) {
    return { rows: [], errors: ['No input fields selected. Save at least one field first.'] }
  }
  const chunks = raw.split(/\r?\n/)
  const lines = []
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
  const rows = []
  let truncated = false
  for (let i = startIndex; i < lines.length; i++) {
    const rowNum = i - startIndex + 1
    const parts = splitLine(lines[i])
    if (parts.length <= maxIdx) {
      if (
        !pushCapped(
          errors,
          `Row ${rowNum}: expected columns (${expectedLabels}), found ${parts.length} value(s)`,
          maxErrors,
        )
      ) {
        truncated = true
        break
      }
      continue
    }
    const row = {}
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

function validateRows(rows, fields, maxErrors = DEFAULT_MAX_ERRORS) {
  const errors = []
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
      if (field.kind === 'upc') {
        const digits = value.replace(/\D/g, '')
        if (!UPC_DIGITS_RE.test(digits)) {
          if (
            !pushCapped(
              errors,
              `Row ${rowNum}: ${field.label} must be 11 or 12 digits (UPC-A)`,
              maxErrors,
            )
          ) {
            truncated = true
            break
          }
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

function asinFieldDef(fields) {
  return fields.find((f) => f.kind === 'asin' || f.id === 'asin')
}

function analyzeDuplicateAsins(rows, fields) {
  const asinField = asinFieldDef(fields)
  if (!asinField) return { warnings: [], skippedRowNumbers: [] }
  const firstRowByAsin = new Map()
  const warnings = []
  const skippedRowNumbers = []
  for (let index = 0; index < rows.length; index++) {
    const asin = String(rows[index][asinField.id] ?? '').trim().toUpperCase()
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

function dedupeRowsByFirstAsin(rows, fields) {
  const asinField = asinFieldDef(fields)
  if (!asinField) return rows
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const asin = String(row[asinField.id] ?? '').trim().toUpperCase()
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

function stripBom(raw) {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
}

function hasBinaryContent(raw) {
  for (let i = 0; i < Math.min(raw.length, 8192); i++) {
    if (raw.charCodeAt(i) === 0) return true
  }
  return false
}

function validateFieldIds(fieldIds) {
  const errors = []
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    return { fields: [], errors: ['Save at least one input field before validating'] }
  }
  const allowed = new Set(AVAILABLE_INPUT_FIELDS.map((f) => f.id))
  for (const id of fieldIds) {
    if (!allowed.has(id)) {
      errors.push(`Unknown input field "${id}". Save fields again from the catalog.`)
    }
  }
  const fields = fieldsFromIds(fieldIds)
  if (fields.length === 0) {
    errors.push('No valid input fields selected')
  }
  return { fields, errors }
}

function validateFileMeta(mode, file) {
  if (mode !== 'file') return []
  const errors = []
  if (!file?.name) {
    errors.push('Choose a .csv or .txt file first')
    return errors
  }
  const lower = file.name.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''
  if (file.name.toLowerCase().endsWith('.xlsx')) {
    errors.push(
      'Excel (.xlsx) is not parsed in this template. Export to CSV or paste tab-separated rows from Excel.',
    )
    return errors
  }
  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    errors.push('Unsupported file type. Use .csv, .txt, or .tsv')
  }
  if (typeof file.size !== 'number' || file.size <= 0) {
    errors.push('Selected file is empty')
  } else if (file.size > QC_UPLOAD_MAX_BYTES) {
    errors.push(`File exceeds ${Math.round(QC_UPLOAD_MAX_BYTES / (1024 * 1024))} MB limit`)
  }
  return errors
}

export function runUploadValidation(request) {
  const errors = []
  const { fields, errors: fieldErrors } = validateFieldIds(request.fieldIds ?? [])
  errors.push(...fieldErrors)
  errors.push(...validateFileMeta(request.mode, request.file))
  if (errors.length > 0) {
    return { ok: false, errors }
  }

  let raw = stripBom(request.raw ?? '')
  if (!raw.trim()) {
    return { ok: false, errors: ['Paste or upload product data before validating'] }
  }
  if (hasBinaryContent(raw)) {
    return {
      ok: false,
      errors: ['File content looks binary or corrupted. Use UTF-8 CSV or paste plain text.'],
    }
  }

  const { rows, errors: parseErrors } = parseDelimitedText(raw, fields)
  errors.push(...parseErrors)
  if (rows.length > QC_UPLOAD_MAX_ROWS) {
    errors.push(`Too many rows (${rows.length}). Maximum is ${QC_UPLOAD_MAX_ROWS}.`)
  }
  if (rows.length < 1 && parseErrors.length === 0) {
    errors.push('At least one data row is required')
  }
  errors.push(...validateRows(rows, fields))
  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const { warnings: asinWarnings, skippedRowNumbers } = analyzeDuplicateAsins(rows, fields)
  if (asinWarnings.length > 0 && !request.acceptDuplicateAsins) {
    return { ok: false, errors: asinWarnings, duplicateAsinBlocked: true }
  }

  const deduped = asinWarnings.length > 0 ? dedupeRowsByFirstAsin(rows, fields) : rows
  const normalizedRows = normalizeRowsForQueue(deduped)
  return {
    ok: true,
    rows: normalizedRows,
    fields,
    skippedDuplicateAsinRows: skippedRowNumbers.length > 0 ? skippedRowNumbers.length : undefined,
  }
}
