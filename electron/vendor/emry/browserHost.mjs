import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEmryChromeProfilePath } from './chromeProfile.mjs'
import { loadEmryPortalCredentials } from './emryPortalCredentials.mjs'
import { getVendorSessionStatus, markSessionDisarmed } from './sessionState.mjs'

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'browserWorker.mjs')

/** @type {import('node:child_process').ChildProcess | null} */
let child = null
let seq = 0
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const pending = new Map()
let stdoutBuf = ''

function cacheStatus(status) {
  if (!status || typeof status !== 'object') return
  const current = getVendorSessionStatus()
  if (status.state && status.state !== current.state) {
    // sessionState lives in the worker; mirror the phase locally for IPC reads
  }
  mirrored.status = status
}

const mirrored = {
  status: getVendorSessionStatus(),
}

function ensureWorker() {
  if (child && child.exitCode == null && !child.killed) return child

  child = spawn(process.execPath, [workerPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk) => {
    stdoutBuf += chunk
    let idx = stdoutBuf.indexOf('\n')
    while (idx >= 0) {
      const line = stdoutBuf.slice(0, idx).trim()
      stdoutBuf = stdoutBuf.slice(idx + 1)
      if (line) {
        try {
          const message = JSON.parse(line)
          cacheStatus(message.status)
          const waiter = pending.get(message.id)
          if (waiter) {
            pending.delete(message.id)
            waiter.resolve(message)
          }
        } catch {
          // ignore non-json
        }
      }
      idx = stdoutBuf.indexOf('\n')
    }
  })

  child.on('exit', () => {
    for (const waiter of pending.values()) {
      waiter.resolve({ ok: false, error: 'EMRY browser worker exited.', log: [] })
    }
    pending.clear()
    child = null
    markSessionDisarmed('Browser worker exited')
    mirrored.status = getVendorSessionStatus()
  })

  return child
}

/**
 * @param {string} cmd
 * @param {Record<string, unknown>} [extra]
 */
function send(cmd, extra = {}) {
  const proc = ensureWorker()
  const id = ++seq
  const profilePath = getEmryChromeProfilePath()
  const payload = JSON.stringify({ id, cmd, profilePath, ...extra })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve({
        ok: false,
        error: 'EMRY browser worker timed out.',
        log: ['Timed out waiting for headed Chrome'],
        status: mirrored.status,
      })
    }, 180_000)
    pending.set(id, {
      resolve: (message) => {
        clearTimeout(timer)
        resolve(message)
      },
      reject,
    })
    proc.stdin?.write(`${payload}\n`)
  })
}

export function getMirroredVendorSessionStatus() {
  return mirrored.status
}

export async function workerLogin() {
  const creds = await loadEmryPortalCredentials()
  return send('login', { email: creds.email, password: creds.password })
}

export async function workerRelogin() {
  const creds = await loadEmryPortalCredentials()
  return send('relogin', { email: creds.email, password: creds.password })
}

export async function workerClose() {
  if (!child) {
    markSessionDisarmed('Browser session closed')
    mirrored.status = getVendorSessionStatus()
    return { ok: true, status: mirrored.status, log: ['No headed Chrome session was open'] }
  }
  return send('close')
}

export async function workerSearchUpc(upc) {
  return send('searchUpc', { upc })
}

export async function workerLookupUpc(upc) {
  return send('lookupUpc', { upc })
}

export async function workerItemDetail(sku) {
  return send('itemDetail', { sku })
}

export async function workerCheck() {
  if (!child) {
    return {
      ok: false,
      kind: 'authentication',
      error: 'Portal session is not armed.',
      status: mirrored.status,
      log: [],
    }
  }
  return send('check')
}
