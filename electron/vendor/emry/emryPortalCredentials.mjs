import { getDecryptedValues } from '../../credentialsStore.mjs'

export { EJD_LOGIN_URL, EJD_HOME_URL, EMRY_ACTIVE_STORE_ID } from './emryPortalUrls.mjs'

const PORTAL_KEYS = ['QC_PORTAL_URL', 'QC_PORTAL_USERNAME', 'QC_PORTAL_PASSWORD']

/**
 * @returns {Promise<{ portalUrl: string, email: string, password: string }>}
 */
export async function loadEmryPortalCredentials() {
  const values = await getDecryptedValues(PORTAL_KEYS)
  const email = values.QC_PORTAL_USERNAME?.trim() ?? ''
  const password = values.QC_PORTAL_PASSWORD?.trim() ?? ''
  const portalUrl = (values.QC_PORTAL_URL?.trim() || 'https://ejdportal.com').replace(/\/+$/, '')

  if (!email || !password) {
    throw new Error('Save portal email and password on the Credentials page before logging in.')
  }

  return { portalUrl, email, password }
}
