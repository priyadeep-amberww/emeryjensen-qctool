import type { QcResult } from './qc'
import type { ExportVerdictFilter } from '../utils/qcExport'

export type CustomExportConfig = {
  /** Display order for optional columns (mandatory columns are always first). */
  optionalOrder: string[]
  optionalEnabled: Record<string, boolean>
  verdictFilter: ExportVerdictFilter
  includeSummarySheet: boolean
}

export type CustomExportTemplate = {
  id: string
  name: string
  config: CustomExportConfig
  updatedAt: number
}

export type CustomExportSummary = {
  total: number
  pass: number
  fail: number
  manual: number
  passPct: string
  failPct: string
  timeTakenLabel: string
}

export type CustomExcelExportRequest = {
  results: QcResult[]
  filter: ExportVerdictFilter
  columnKeys: string[]
  includeSummarySheet: boolean
  summary?: CustomExportSummary
}

export type CustomExcelExportSuccess = {
  ok: true
  filePath?: string
  fileName: string
  rowCount: number
  base64?: string
  mime?: string
}

export type CustomExcelExportFailure = {
  ok: false
  error: string
}

export type CustomExcelExportResponse = CustomExcelExportSuccess | CustomExcelExportFailure
