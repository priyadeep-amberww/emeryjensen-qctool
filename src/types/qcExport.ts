import type { QcResult } from './qc'
import type { ExportVerdictFilter } from '../utils/qcExport'

export type QcExportScope = 'partial' | 'full'

export type QcExportFormat = 'xlsx'

export type QcExportRequest = {
  scope: QcExportScope
  /** Batch export is always Excel (.xlsx). */
  format?: QcExportFormat
  filter: ExportVerdictFilter
  /** Preferred: load rows from the batch session in the main process (avoids huge IPC payloads). */
  sessionId?: string
  /** Fallback when no session store is available (web dev). */
  results?: QcResult[]
  /** Batch size from upload — required when scope is `full`. */
  batchTotal: number
  vendorDisplayName?: string
}

export type QcExportSuccess = {
  ok: true
  filePath?: string
  fileName: string
  rowCount: number
  format: QcExportFormat
  scope: QcExportScope
}

export type QcExportFailure = {
  ok: false
  error: string
}

export type QcExportResponse = QcExportSuccess | QcExportFailure
