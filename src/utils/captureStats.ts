import type { CaptureStatus, QcResult } from '../types/qc'

export type CaptureStatusCounts = {
  captured: number
  not_on_portal: number
  bad_parse: number
  sp_api_failed: number
}

export function emptyCaptureStatusCounts(): CaptureStatusCounts {
  return { captured: 0, not_on_portal: 0, bad_parse: 0, sp_api_failed: 0 }
}

export function countCaptureStatuses(results: readonly QcResult[]): CaptureStatusCounts {
  const counts = emptyCaptureStatusCounts()
  for (const row of results) {
    const status = row.captureStatus
    if (!status) continue
    counts[status] += 1
  }
  return counts
}

export function hasCaptureResults(results: readonly QcResult[]): boolean {
  return results.some((r) => r.captureStatus != null)
}

export function captureStatusSearchLabel(status: CaptureStatus): string {
  return status.replace(/_/g, ' ')
}
