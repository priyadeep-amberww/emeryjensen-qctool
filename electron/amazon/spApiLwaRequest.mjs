import { SP_API_HOST } from './spApiCredentialKeys.mjs'

const USER_AGENT = 'Grand-QC-Tool/2.4'

/**
 * @param {{ accessToken: string, path: string, query?: string }} params
 * @returns {Promise<{ ok: true, status: number, json: unknown } | { ok: false, status: number, error: string }>}
 */
export async function spApiLwaGet(params) {
  const accessToken = params.accessToken?.trim()
  const pathPart = params.path?.startsWith('/') ? params.path : `/${params.path ?? ''}`
  const query = params.query?.trim()
  const url = `https://${SP_API_HOST}${pathPart}${query ? `?${query}` : ''}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-amz-access-token': accessToken,
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
  })

  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 240)
    try {
      const json = JSON.parse(text)
      detail = json?.errors?.[0]?.message ?? json?.message ?? detail
    } catch {
      /* use snippet */
    }
    return {
      ok: false,
      status: res.status,
      error: `Amazon SP-API request failed (HTTP ${res.status}): ${detail}`,
    }
  }

  try {
    return { ok: true, status: res.status, json: JSON.parse(text) }
  } catch {
    return { ok: false, status: res.status, error: 'Amazon SP-API response was not valid JSON.' }
  }
}

/**
 * @param {{ accessToken: string, path: string, body: unknown }} params
 */
export async function spApiLwaPost(params) {
  const accessToken = params.accessToken?.trim()
  const pathPart = params.path?.startsWith('/') ? params.path : `/${params.path ?? ''}`
  const url = `https://${SP_API_HOST}${pathPart}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-amz-access-token': accessToken,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify(params.body ?? {}),
  })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Amazon SP-API request failed (HTTP ${res.status}): ${text.slice(0, 240)}` }
  }
  try {
    return { ok: true, status: res.status, json: JSON.parse(text) }
  } catch {
    return { ok: false, status: res.status, error: 'Amazon SP-API response was not valid JSON.' }
  }
}

/**
 * @param {Record<string, string>} values
 * @returns {string | null} Human-readable missing field names, or null if complete.
 */
export function formatMissingSpApiLwaFields(values) {
  const missing = []
  if (!values.SP_API_CLIENT_ID?.trim()) missing.push('Client ID')
  if (!values.SP_API_CLIENT_SECRET?.trim()) missing.push('Client Secret')
  if (!values.SP_API_REFRESH_TOKEN?.trim()) missing.push('Refresh Token')
  if (missing.length === 0) return null
  return `Missing Amazon SP-API ${missing.join(', ')}. Save them on the Credentials page.`
}
