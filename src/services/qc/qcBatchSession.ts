import type { InputRow } from '../../utils/inputParse'
import type { QcResult } from '../../types/qc'

export type BatchSessionState = 'validated' | 'running' | 'paused' | 'stopped' | 'done'

export type BatchSession = {
  sessionId: string
  fieldIds: string[]
  rows: InputRow[]
  results: QcResult[]
  state: BatchSessionState
  createdAt: number
}

const sessions = new Map<string, BatchSession>()

export function createBatchSession(sessionId: string, fieldIds: string[], rows: InputRow[]): BatchSession {
  const session: BatchSession = {
    sessionId,
    fieldIds: [...fieldIds],
    rows: rows.map((row) => ({ ...row })),
    results: [],
    state: 'validated',
    createdAt: Date.now(),
  }
  sessions.set(sessionId, session)
  return session
}

export function getBatchSession(sessionId: string): BatchSession | null {
  return sessions.get(sessionId) ?? null
}

export function markBatchRunning(sessionId: string): BatchSession | null {
  const session = sessions.get(sessionId)
  if (!session) return null
  if (session.state !== 'validated') return null
  session.results = []
  session.state = 'running'
  return session
}

export function appendBatchResult(sessionId: string, result: QcResult): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false
  session.results.push(result)
  return true
}

export function getBatchResults(sessionId: string): QcResult[] {
  const session = sessions.get(sessionId)
  if (!session) return []
  return session.results
}

export function markBatchPaused(sessionId: string): BatchSession | null {
  const session = sessions.get(sessionId)
  if (!session || session.state !== 'running') return null
  session.state = 'paused'
  return session
}

export function markBatchResumed(sessionId: string): BatchSession | null {
  const session = sessions.get(sessionId)
  if (!session || session.state !== 'paused') return null
  session.state = 'running'
  return session
}

export function markBatchStopped(sessionId: string): BatchSession | null {
  const session = sessions.get(sessionId)
  if (!session || (session.state !== 'running' && session.state !== 'paused')) return null
  session.state = 'stopped'
  return session
}

export function markBatchDone(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return
  if (session.state === 'running' || session.state === 'paused') {
    session.state = 'done'
  }
}

export function clearBatchSessions(): void {
  sessions.clear()
}
