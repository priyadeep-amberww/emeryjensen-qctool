/** In-process run gate the QC tool checks between portal and Amazon steps. */
const modes = new Map()

export function setRunControl(sessionId, mode) {
  if (!sessionId) return
  modes.set(sessionId, mode)
}

export function clearRunControl(sessionId) {
  if (sessionId) modes.delete(sessionId)
}

/** True when the operator or the connectivity watchdog has halted this session. */
export function isRunHalted(sessionId) {
  if (!sessionId) return false
  const mode = modes.get(sessionId)
  return mode === 'paused' || mode === 'stopped'
}
