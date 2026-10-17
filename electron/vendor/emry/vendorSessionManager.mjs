import {
  getMirroredVendorSessionStatus,
  workerCheck,
  workerClose,
  workerLogin,
  workerRelogin,
} from './browserHost.mjs'
import { isSessionArmed, markSessionDisarmed } from './sessionState.mjs'

function asResult(message) {
  const log = Array.isArray(message?.log) ? message.log : []
  if (message?.ok) {
    return { ok: true, log, status: message.status }
  }
  return {
    ok: false,
    error: message?.error ?? message?.detail ?? 'EMRY portal login failed.',
    log,
    status: message?.status,
    kind: message?.kind,
  }
}

/**
 * @param {{ vendorLoginRequired?: boolean; reuseSession?: boolean }} request
 */
export async function performEmryVendorLogin(request = {}) {
  if (request.vendorLoginRequired === false) {
    return { ok: true, skipped: true, log: [] }
  }

  if (request.reuseSession) {
    const check = await workerCheck()
    if (check.ok) {
      return { ok: true, log: check.log ?? ['Reused armed portal session'], status: check.status }
    }
    markSessionDisarmed(check.error ?? 'Session not armed')
  }

  return asResult(await workerLogin())
}

export async function cancelEmryVendorBrowserSession() {
  return asResult(await workerClose())
}

export async function reloginEmryVendorSession() {
  return asResult(await workerRelogin())
}

export async function ensureEmrySessionForScrape() {
  const check = await workerCheck()
  if (check.ok && isSessionArmed()) {
    return { ok: true }
  }
  if (check.ok) {
    return { ok: true }
  }
  const login = await performEmryVendorLogin({ vendorLoginRequired: true, reuseSession: false })
  if (!login.ok) {
    return { ok: false, kind: 'authentication', error: login.error ?? 'Not logged in' }
  }
  return { ok: true }
}

export function getVendorSessionStatus() {
  return getMirroredVendorSessionStatus()
}
