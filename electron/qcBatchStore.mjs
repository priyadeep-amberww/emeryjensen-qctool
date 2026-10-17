const sessions = new Map()

function newSessionId() {
  return `qc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function createBatchSession(sessionId, fieldIds, rows) {
  const session = {
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

export function clearBatchResults(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return false
  session.results = []
  return true
}

export function appendBatchResult(sessionId, result) {
  const session = sessions.get(sessionId)
  if (!session) return false
  if (!Array.isArray(session.results)) session.results = []
  session.results.push(result)
  return true
}

export function getBatchResults(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || !Array.isArray(session.results)) return []
  return session.results
}

export function getBatchSession(sessionId) {
  return sessions.get(sessionId) ?? null
}

export function markBatchRunning(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || session.state !== 'validated') return null
  session.results = []
  session.state = 'running'
  return session
}

export function markBatchPaused(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || session.state !== 'running') return null
  session.state = 'paused'
  return session
}

export function markBatchResumed(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || session.state !== 'paused') return null
  session.state = 'running'
  return session
}

export function markBatchStopped(sessionId) {
  const session = sessions.get(sessionId)
  if (!session || (session.state !== 'running' && session.state !== 'paused')) return null
  session.state = 'stopped'
  return session
}

export function markBatchDone(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return
  if (session.state === 'running' || session.state === 'paused') {
    session.state = 'done'
  }
}

export { newSessionId }
