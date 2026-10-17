import { chromium } from 'playwright'
import { markSessionDisarmed } from './sessionState.mjs'

let profilePath = ''

export function setEmryProfilePath(nextPath) {
  profilePath = nextPath
}

/** @type {import('playwright').BrowserContext | null} */
let context = null
/** @type {import('playwright').Page | null} */
let primaryPage = null

export function getEmryBrowserContext() {
  return context
}

export function getEmryPrimaryPage() {
  return primaryPage
}

/**
 * @returns {Promise<import('playwright').Page>}
 */
export async function ensureEmryBrowserPage() {
  if (context && primaryPage && !primaryPage.isClosed()) {
    return primaryPage
  }

  if (!profilePath) {
    throw new Error('EMRY Chrome profile path was not set.')
  }
  context = await chromium.launchPersistentContext(profilePath, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1400, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const pages = context.pages()
  primaryPage = pages.length > 0 ? pages[0] : await context.newPage()
  return primaryPage
}

export async function closeEmryBrowserSession() {
  if (context) {
    try {
      await context.close()
    } catch {
      // ignore close errors
    }
  }
  context = null
  primaryPage = null
  markSessionDisarmed('Browser session closed')
}
