import { EJD_HOME_URL, EMRY_ACTIVE_STORE_ID } from './emryPortalUrls.mjs'

/**
 * F5 logout copy is "To log back in, click here." Only the words "click here" are the link.
 * @param {import('playwright').Page} page
 */
export function f5ReloginLink(page) {
  return page.getByRole('link', { name: /^click here\.?$/i }).first()
}

/**
 * @param {import('playwright').Page} page
 */
export async function isF5LogoutVisible(page) {
  const url = page.url()
  if (/my\.logout\.php3/i.test(url) || /logged off/i.test(url)) return true
  try {
    if (await f5ReloginLink(page).isVisible({ timeout: 1500 })) return true
  } catch {
    // ignore
  }
  try {
    const loggedOff = page.getByText(/you have successfully logged off/i)
    return await loggedOff.isVisible({ timeout: 800 })
  } catch {
    return false
  }
}

/**
 * @param {import('playwright').Page} page
 */
export async function isEmryHomeSession(page) {
  const url = page.url()
  if (!url.includes('ejdportal.com')) return false
  if (!url.includes('AppHost.aspx') || !url.includes('p=Home')) return false

  try {
    const bodyText = await page.locator('body').innerText({ timeout: 5000 })
    const hasStore =
      bodyText.includes(EMRY_ACTIVE_STORE_ID) &&
      (bodyText.includes('Active Store') ||
        bodyText.includes('PRODUCT MGMT') ||
        bodyText.includes('Product Mgmt'))
    return hasStore
  } catch {
    return false
  }
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<{ ok: true } | { ok: false; reason: string }>}
 */
export async function assertEmrySessionAlive(page) {
  const url = page.url()
  if (url.includes('my.policy') || /my\.logout\.php3/i.test(url)) {
    return { ok: false, reason: 'Session expired (F5 logout page)' }
  }
  if (await isF5LogoutVisible(page)) {
    return { ok: false, reason: 'Session expired (F5 logout page)' }
  }
  if (!(await isEmryHomeSession(page))) {
    return { ok: false, reason: `Session not on confirmed home (${EJD_HOME_URL})` }
  }
  return { ok: true }
}
