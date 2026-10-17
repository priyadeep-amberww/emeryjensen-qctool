/**
 * Login with Amazon (LWA) access token for SP-API requests.
 */

/**
 * @param {{ clientId: string, clientSecret: string, refreshToken: string }} creds
 * @returns {Promise<{ ok: true, accessToken: string } | { ok: false, error: string }>}
 */
export async function fetchLwaAccessToken(creds) {
  const clientId = creds.clientId?.trim()
  const clientSecret = creds.clientSecret?.trim()
  const refreshToken = creds.refreshToken?.trim()

  if (!clientId || !clientSecret || !refreshToken) {
    return { ok: false, error: 'Missing LWA client ID, client secret, or refresh token.' }
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const json = await res.json()
      detail = json?.error_description ?? json?.error ?? ''
    } catch {
      detail = (await res.text().catch(() => '')).slice(0, 120)
    }
    return {
      ok: false,
      error: detail
        ? `Amazon LWA authentication failed: ${detail}`
        : 'Amazon LWA authentication failed. Check SP-API credentials.',
    }
  }

  const json = await res.json()
  const accessToken = json?.access_token
  if (!accessToken || typeof accessToken !== 'string') {
    return { ok: false, error: 'Amazon LWA response did not include an access token.' }
  }

  return { ok: true, accessToken }
}
