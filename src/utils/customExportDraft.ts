import type { CustomExportConfig } from '../types/customExport'
import type { ExportVerdictFilter } from './qcExport'
import {
  defaultOptionalEnabled,
  defaultOptionalOrder,
  discoverExportCatalog,
  resolveExportColumnKeys,
} from './qcExportColumns'
import type { QcResult } from '../types/qc'

const DRAFT_KEY = 'grand_qc_custom_export_draft'
const LOCKED_KEY = 'grand_qc_custom_export_locked_snapshot'

export type CustomExportDraft = CustomExportConfig

export function createDefaultExportDraft(results: QcResult[] = []): CustomExportDraft {
  const { optional } = discoverExportCatalog(results)
  return {
    optionalOrder: defaultOptionalOrder(optional),
    optionalEnabled: defaultOptionalEnabled(optional),
    verdictFilter: 'all',
    includeSummarySheet: true,
  }
}

function parseDraft(raw: unknown): CustomExportDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (Array.isArray(obj.columnKeys) && !obj.optionalOrder) {
    const legacyKeys = obj.columnKeys as string[]
    const base = createDefaultExportDraft()
    const enabled: Record<string, boolean> = { ...base.optionalEnabled }
    for (const key of Object.keys(enabled)) {
      enabled[key] = legacyKeys.includes(key)
    }
    return {
      optionalOrder: base.optionalOrder,
      optionalEnabled: enabled,
      verdictFilter: (obj.verdictFilter as ExportVerdictFilter) ?? 'all',
      includeSummarySheet: Boolean(obj.includeSummarySheet ?? true),
    }
  }
  if (!Array.isArray(obj.optionalOrder) || typeof obj.optionalEnabled !== 'object') return null
  return {
    optionalOrder: obj.optionalOrder as string[],
    optionalEnabled: obj.optionalEnabled as Record<string, boolean>,
    verdictFilter: (obj.verdictFilter as ExportVerdictFilter) ?? 'all',
    includeSummarySheet: Boolean(obj.includeSummarySheet ?? true),
  }
}

export function readExportDraft(results: QcResult[] = []): CustomExportDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return createDefaultExportDraft(results)
    const parsed = parseDraft(JSON.parse(raw))
    if (!parsed) return createDefaultExportDraft(results)
    return mergeDraftWithCatalog(parsed, results)
  } catch {
    return createDefaultExportDraft(results)
  }
}

export function writeExportDraft(draft: CustomExportDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function lockExportSnapshot(draft: CustomExportDraft) {
  localStorage.setItem(LOCKED_KEY, JSON.stringify(draft))
}

export function readLockedExportSnapshot(): CustomExportDraft | null {
  try {
    const raw = localStorage.getItem(LOCKED_KEY)
    if (!raw) return null
    return parseDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearExportLockSnapshot() {
  localStorage.removeItem(LOCKED_KEY)
}

export function mergeDraftWithCatalog(draft: CustomExportDraft, results: QcResult[]): CustomExportDraft {
  const { optional } = discoverExportCatalog(results)
  const catalogKeys = optional.map((c) => c.key)
  const order = mergeOptionalOrder(catalogKeys, draft.optionalOrder)
  const enabled = { ...defaultOptionalEnabled(optional), ...draft.optionalEnabled }
  for (const key of Object.keys(enabled)) {
    if (!catalogKeys.includes(key)) delete enabled[key]
  }
  for (const key of catalogKeys) {
    if (enabled[key] === undefined) enabled[key] = true
  }
  return {
    ...draft,
    optionalOrder: order,
    optionalEnabled: enabled,
  }
}

function mergeOptionalOrder(catalogKeys: string[], previous: string[]): string[] {
  const kept = previous.filter((k) => catalogKeys.includes(k))
  const added = catalogKeys.filter((k) => !kept.includes(k))
  return [...kept, ...added]
}

export function draftToColumnKeys(draft: CustomExportDraft, results: QcResult[]): string[] {
  const { mandatory } = discoverExportCatalog(results)
  return resolveExportColumnKeys(mandatory, draft.optionalOrder, draft.optionalEnabled)
}
