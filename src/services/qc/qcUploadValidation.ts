import { AVAILABLE_INPUT_FIELDS, fieldsFromIds, type InputFieldDef } from '../../data/inputFields'
import {
  analyzeDuplicateAsins,
  dedupeRowsByFirstAsin,
  normalizeRowsForQueue,
  parseDelimitedText,
  validateRows,
  type InputRow,
} from '../../utils/inputParse'
import type { QcUploadMode, QcValidateRequest } from '../../types/qcUpload'

export const QC_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
export const QC_UPLOAD_MAX_ROWS = 15_000
export const QC_UPLOAD_MIN_ROWS = 1
const ALLOWED_FILE_EXTENSIONS = new Set(['.csv', '.txt', '.tsv'])

export type UploadValidationResult =
  | { ok: true; rows: InputRow[]; fields: InputFieldDef[]; skippedDuplicateAsinRows?: number }
  | { ok: false; errors: string[]; duplicateAsinBlocked?: boolean }

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
}

function hasBinaryContent(raw: string): boolean {
  for (let i = 0; i < Math.min(raw.length, 8192); i++) {
    const code = raw.charCodeAt(i)
    if (code === 0) return true
  }
  return false
}

function validateFieldIds(fieldIds: string[]): { fields: InputFieldDef[]; errors: string[] } {
  const errors: string[] = []
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

function validateFileMeta(
  mode: QcUploadMode,
  file?: QcValidateRequest['file'],
): string[] {
  if (mode !== 'file') return []
  const errors: string[] = []
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

/** Full upload validation pipeline (parse, structure, and row integrity). */
export function runUploadValidation(request: QcValidateRequest): UploadValidationResult {
  const errors: string[] = []

  const { fields, errors: fieldErrors } = validateFieldIds(request.fieldIds)
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
  if (rows.length < QC_UPLOAD_MIN_ROWS && parseErrors.length === 0) {
    errors.push('At least one data row is required')
  }

  const rowErrors = validateRows(rows, fields)
  errors.push(...rowErrors)

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const { warnings: asinWarnings, skippedRowNumbers } = analyzeDuplicateAsins(rows, fields)
  if (asinWarnings.length > 0 && !request.acceptDuplicateAsins) {
    return { ok: false, errors: asinWarnings, duplicateAsinBlocked: true }
  }

  const rowsForQueue = normalizeRowsForQueue(
    asinWarnings.length > 0 ? dedupeRowsByFirstAsin(rows, fields) : rows,
  )

  return {
    ok: true,
    rows: rowsForQueue,
    fields,
    skippedDuplicateAsinRows: skippedRowNumbers.length > 0 ? skippedRowNumbers.length : undefined,
  }
}
