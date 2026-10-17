import type { QcProcessStatus } from '../../types/qc'
import type { QcResult } from '../../types/qc'

export type QcEngineEventName =
  | 'onBatchStart'
  | 'onProgress'
  | 'onHalfway'
  | 'onPeriodicStatus'
  | 'onError'
  | 'onBatchPause'
  | 'onBatchStop'
  | 'onBatchComplete'

export type QcEngineEventPayload = {
  event: QcEngineEventName
  batchLabel: string | null
  completed_count: number
  total_count: number
  pass_rate: number
  status: QcProcessStatus
  elapsed_time: string
  error_message?: string
}

type QcEngineListener = (payload: QcEngineEventPayload) => void

const listeners = new Set<QcEngineListener>()

export function subscribeQcEngineEvents(listener: QcEngineListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitQcEngineEvent(
  event: QcEngineEventName,
  partial: Omit<QcEngineEventPayload, 'event'>,
): void {
  const payload: QcEngineEventPayload = { event, ...partial }
  for (const listener of listeners) {
    try {
      listener(payload)
    } catch {
      // isolate listener failures
    }
  }
}

export function formatElapsedTime(startedAtMs: number | null, nowMs = Date.now()): string {
  if (!startedAtMs) return '0m'
  const sec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function computePassRate(completed: readonly QcResult[]): number {
  if (completed.length === 0) return 0
  const pass = completed.filter((r) => r.verdict === 'PASS').length
  return Math.round((pass / completed.length) * 100)
}

export function buildQcEventPayload(args: {
  batchLabel: string | null
  completedCount: number
  passCount: number
  total: number
  status: QcProcessStatus
  startedAt: number | null
  error_message?: string
}): Omit<QcEngineEventPayload, 'event'> {
  const completedCount = args.completedCount
  const passRate =
    completedCount === 0 ? 0 : Math.round((args.passCount / completedCount) * 100)
  return {
    batchLabel: args.batchLabel,
    completed_count: completedCount,
    total_count: args.total,
    pass_rate: passRate,
    status: args.status,
    elapsed_time: formatElapsedTime(args.startedAt),
    error_message: args.error_message,
  }
}

/** @deprecated Prefer `buildQcEventPayload` with counts for large batches. */
export function buildQcEventPayloadFromResults(args: {
  batchLabel: string | null
  completed: readonly QcResult[]
  total: number
  status: QcProcessStatus
  startedAt: number | null
  error_message?: string
}): Omit<QcEngineEventPayload, 'event'> {
  let passCount = 0
  for (const row of args.completed) {
    if (row.verdict === 'PASS') passCount += 1
  }
  return buildQcEventPayload({
    batchLabel: args.batchLabel,
    completedCount: args.completed.length,
    passCount,
    total: args.total,
    status: args.status,
    startedAt: args.startedAt,
    error_message: args.error_message,
  })
}
