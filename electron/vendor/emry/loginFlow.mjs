import { EJD_HOME_URL, EJD_LOGIN_URL, EMRY_ACTIVE_STORE_ID } from './emryPortalUrls.mjs'
import { ensureEmryBrowserPage } from './browserSession.mjs'
import { f5ReloginLink, isEmryHomeSession, isF5LogoutVisible } from './sessionWatch.mjs'
import { markSessionArmed, setVendorSessionPhase } from './sessionState.mjs'

const NAV_TIMEOUT_MS = 120_000
const TYPE_DELAY_MS = 110

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {import('playwright').Locator} locator
 * @param {string} text
 */
async function typeLikeHuman(locator, text) {
  await locator.click()
  await pause(300)
  await locator.fill('')
  await locator.pressSequentially(text, { delay: TYPE_DELAY_MS })
  await pause(400)
}

/**
 * @param {(line: string) => void} [logLine]
 */
function makeLogger(logLine) {
  return (message) => {
    if (logLine) logLine(message)
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {(line: string) => void} log
 */
async function handleF5LogoutIfPresent(page, log) {
  if (!(await isF5LogoutVisible(page))) return
  log('F5 logout page detected — clicking the "click here" link')
  const link = f5ReloginLink(page)
  await link.waitFor({ state: 'visible', timeout: 20_000 })
  await pause(900)
  await link.click()
  await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT_MS })
  log(`After F5 click, page is ${page.url()}`)
}

/**
 * @param {import('playwright').Page} page
 * @param {string} email
 * @param {string} password
 * @param {(line: string) => void} log
 */
async function submitPortalLogin(page, email, password, log) {
  log('Waiting for login form')
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.waitFor({ state: 'visible', timeout: NAV_TIMEOUT_MS })

  const emailCandidates = [
    page.locator('input[type="email"]').first(),
    page.locator('input[name*="user" i]').first(),
    page.locator('input[id*="user" i]').first(),
    page.locator('input[type="text"]').first(),
  ]

  let emailInput = null
  for (const candidate of emailCandidates) {
    if (await candidate.isVisible({ timeout: 1500 }).catch(() => false)) {
      emailInput = candidate
      break
    }
  }
  if (!emailInput) {
    throw new Error('Could not find portal email/username field on login page.')
  }

  log('Typing portal email')
  await typeLikeHuman(emailInput, email)
  log('Typing portal password')
  await typeLikeHuman(passwordInput, password)
  await pause(700)
  log('Submitting portal credentials')

  const submit = page
    .getByRole('button', { name: /log\s*in|sign\s*in|submit/i })
    .first()
  if (await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
    await submit.click()
  } else {
    await passwordInput.press('Enter')
  }
  await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT_MS })
}

/**
 * @param {import('playwright').Page} page
 * @param {(line: string) => void} log
 */
async function selectActiveStore(page, log) {
  log(`Selecting warehouse store ${EMRY_ACTIVE_STORE_ID} (Amber Worldwide)`)
  const storeRow = page
    .locator('tr, a, [role="row"], td')
    .filter({ hasText: EMRY_ACTIVE_STORE_ID })
    .filter({ hasText: /amber\s*worldwide/i })
    .first()

  if (await storeRow.isVisible({ timeout: 45_000 }).catch(() => false)) {
    await pause(800)
    await storeRow.click()
  } else {
    const fallback = page.getByText(new RegExp(`${EMRY_ACTIVE_STORE_ID}.*amber`, 'i')).first()
    await fallback.waitFor({ state: 'visible', timeout: 45_000 })
    await pause(800)
    await fallback.click()
  }

  await page.waitForTimeout(1500)
}

/**
 * @param {import('playwright').Page} page
 * @param {(line: string) => void} log
 */
async function waitForHomeConfirmation(page, log) {
  log(`Waiting for home confirmation (${EJD_HOME_URL})`)
  await page.waitForURL(/AppHost\.aspx\?p=Home/i, { timeout: NAV_TIMEOUT_MS }).catch(async () => {
    if (!(await isEmryHomeSession(page))) {
      await page.goto(EJD_HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    }
  })

  const deadline = Date.now() + NAV_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isEmryHomeSession(page)) return
    await page.waitForTimeout(750)
  }
  throw new Error('Login did not reach confirmed EJD home with active store 34533.')
}

/**
 * Full headed login for Emery Jensen Distribution portal.
 * @param {{ logLine?: (line: string) => void }} [options]
 */
export async function runEmryLoginFlow(options = {}) {
  const log = makeLogger(options.logLine)
  const email = options.email?.trim() ?? ''
  const password = options.password ?? ''
  if (!email || !password) {
    throw new Error('Save portal email and password on the Credentials page before logging in.')
  }

  setVendorSessionPhase('logging_in', 'Opening headed Chrome and logging into EJD portal…')
  log('Launching headed Chrome (dedicated EMRY profile)')
  const page = await ensureEmryBrowserPage()

  log(`Navigate ${EJD_LOGIN_URL}`)
  await page.goto(EJD_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })

  await handleF5LogoutIfPresent(page, log)

  if (await isEmryHomeSession(page)) {
    log('Already on confirmed home session — skipping credential entry')
    markSessionArmed(EMRY_ACTIVE_STORE_ID)
    return { ok: true }
  }

  await submitPortalLogin(page, email, password, log)
  await handleF5LogoutIfPresent(page, log)
  await selectActiveStore(page, log)
  await waitForHomeConfirmation(page, log)

  log('Login confirmed — session armed')
  markSessionArmed(EMRY_ACTIVE_STORE_ID)
  return { ok: true }
}
