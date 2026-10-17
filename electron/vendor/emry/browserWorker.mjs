/**
 * Headed Chrome worker. Runs under ELECTRON_RUN_AS_NODE so Playwright's driver
 * fetch works (Electron's main-process fetch cannot reach the Playwright pipe).
 */
import readline from 'node:readline'
import { setEmryProfilePath, closeEmryBrowserSession, getEmryPrimaryPage } from './browserSession.mjs'
import { runEmryLoginFlow } from './loginFlow.mjs'
import { searchProductByUpcInPortal } from './searchProductByUpc.mjs'
import { lookupSkuByUpc } from './skuByUpc.mjs'
import { fetchItemDetailHtml } from './itemDetail.mjs'
import { assertEmrySessionAlive } from './sessionWatch.mjs'
import {
  getVendorSessionStatus,
  isSessionArmed,
  markSessionDisarmed,
  setVendorSessionPhase,
} from './sessionState.mjs'
import { setScrapeHalted } from './scrapeHalt.mjs'

const rl = readline.createInterface({ input: process.stdin })

function reply(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  void handle(trimmed)
})

async function handle(raw) {
  let request
  try {
    request = JSON.parse(raw)
  } catch {
    reply({ id: null, ok: false, error: 'Invalid worker command.' })
    return
  }

  const id = request.id
  const log = []
  const logLine = (message) => log.push(message)

  try {
    if (typeof request.profilePath === 'string' && request.profilePath) {
      setEmryProfilePath(request.profilePath)
    }

    if (request.cmd === 'halt') {
      setScrapeHalted(true)
      reply({ id, ok: true, status: getVendorSessionStatus(), log: ['Portal scrape halted'] })
      return
    }

    if (request.cmd === 'clearHalt') {
      setScrapeHalted(false)
      reply({ id, ok: true, status: getVendorSessionStatus(), log: ['Portal scrape halt cleared'] })
      return
    }

    if (request.cmd === 'status') {
      reply({ id, ok: true, status: getVendorSessionStatus(), log })
      return
    }

    if (request.cmd === 'close') {
      await closeEmryBrowserSession()
      reply({ id, ok: true, status: getVendorSessionStatus(), log: ['Headed Chrome session closed'] })
      return
    }

    if (request.cmd === 'check') {
      const page = getEmryPrimaryPage()
      if (!page || page.isClosed() || !isSessionArmed()) {
        markSessionDisarmed('Not logged in')
        reply({
          id,
          ok: false,
          kind: 'authentication',
          error: 'Portal session is not armed.',
          status: getVendorSessionStatus(),
          log,
        })
        return
      }
      const alive = await assertEmrySessionAlive(page)
      if (!alive.ok) {
        markSessionDisarmed(alive.reason)
        reply({
          id,
          ok: false,
          kind: 'authentication',
          error: alive.reason,
          status: getVendorSessionStatus(),
          log: [alive.reason],
        })
        return
      }
      reply({ id, ok: true, status: getVendorSessionStatus(), log: ['Portal session still armed'] })
      return
    }

    if (request.cmd === 'lookupUpc') {
      const upc = typeof request.upc === 'string' ? request.upc.trim() : ''
      const lookup = await lookupSkuByUpc(upc, logLine)
      reply({ id, ...lookup, status: getVendorSessionStatus(), log })
      return
    }

    if (request.cmd === 'itemDetail') {
      const sku = typeof request.sku === 'string' ? request.sku.trim() : ''
      const detail = await fetchItemDetailHtml(sku, logLine)
      reply({ id, ...detail, status: getVendorSessionStatus(), log })
      return
    }

    if (request.cmd === 'searchUpc') {
      const upc = typeof request.upc === 'string' ? request.upc.trim() : ''
      const page = getEmryPrimaryPage()
      if (!page || page.isClosed() || !isSessionArmed()) {
        markSessionDisarmed('Not logged in')
        reply({
          id,
          ok: false,
          kind: 'authentication',
          error: 'Portal session is not armed.',
          status: getVendorSessionStatus(),
          log,
        })
        return
      }
      const search = await searchProductByUpcInPortal(upc, logLine)
      if (!search.ok) {
        reply({
          id,
          ok: false,
          kind: search.kind ?? 'network',
          error: search.error ?? 'EJD search failed.',
          status: getVendorSessionStatus(),
          log,
        })
        return
      }
      reply({
        id,
        ok: true,
        status: getVendorSessionStatus(),
        log,
        fragment: search.fragment,
        visibleSku: search.visibleSku ?? '',
        noRecords: search.noRecords,
        elapsedMs: search.elapsedMs,
        searchUrl: search.searchUrl,
      })
      return
    }

    if (request.cmd === 'login' || request.cmd === 'relogin') {
      if (request.cmd === 'relogin') {
        setVendorSessionPhase('relogging', 'Clean relogin')
        logLine('Closing headed Chrome for a clean relogin')
        await closeEmryBrowserSession()
      }
      await runEmryLoginFlow({
        email: request.email,
        password: request.password,
        logLine,
      })
      reply({ id, ok: true, status: getVendorSessionStatus(), log })
      return
    }

    reply({ id, ok: false, error: `Unknown command ${request.cmd}`, status: getVendorSessionStatus(), log })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'EMRY browser worker failed.'
    const detail = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : message
    markSessionDisarmed(message)
    await closeEmryBrowserSession().catch(() => {})
    reply({
      id,
      ok: false,
      error: message,
      detail,
      status: getVendorSessionStatus(),
      log: [...log, message],
    })
  }
}
