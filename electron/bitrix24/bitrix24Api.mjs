const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 800

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeWebhookUrl(raw) {
  const trimmed = String(raw ?? '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed
}

/**
 * @param {{ channelPreference?: string, groupChatId?: string }} opts
 */
export function resolveBitrixDialogId(opts) {
  const pref = String(opts.channelPreference ?? 'group_chat').trim()
  const rawId = String(opts.groupChatId ?? '').trim()
  if (!rawId) return ''

  if (pref === 'user') {
    return rawId.startsWith('user') ? rawId : rawId
  }
  if (pref === 'open_channel') {
    return rawId.startsWith('chat') ? rawId : `chat${rawId}`
  }
  if (rawId.startsWith('chat')) return rawId
  return `chat${rawId}`
}

function buildRestUrl(webhookUrl, method, apiToken) {
  const base = normalizeWebhookUrl(webhookUrl)
  if (base) {
    return `${base}/${method}.json`
  }
  if (apiToken) {
    return `https://oauth.bitrix.info/rest/${method}.json?auth=${encodeURIComponent(apiToken)}`
  }
  return ''
}

/**
 * @param {(attempt: number) => Promise<{ ok: boolean, status?: number, body?: unknown, error?: string }>} fn
 */
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  let lastError = 'Request failed'

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fn(attempt)
      if (result.ok) return { ok: true, attempt, ...result }
      lastError = result.error ?? `HTTP ${result.status ?? 'error'}`
      if (attempt < maxAttempts && (result.status === 429 || (result.status ?? 0) >= 500)) {
        await sleep(baseDelayMs * 2 ** (attempt - 1))
        continue
      }
      return { ok: false, attempt, error: lastError, ...result }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1))
        continue
      }
      return { ok: false, attempt, error: lastError }
    }
  }

  return { ok: false, error: lastError }
}

/**
 * @param {{ webhookUrl?: string, apiToken?: string }} credentials
 */
export async function testBitrix24Connection(credentials) {
  const webhookUrl = credentials.webhookUrl
  const apiToken = credentials.apiToken
  const url = buildRestUrl(webhookUrl, 'user.current', apiToken)
  if (!url) {
    return { ok: false, error: 'Webhook URL or API token is required.' }
  }

  const result = await withRetry(async () => {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 200) }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `Bitrix24 returned HTTP ${res.status}` }
    }
    if (body?.error) {
      return { ok: false, status: res.status, body, error: String(body.error_description ?? body.error) }
    }
    return { ok: true, status: res.status, body }
  })

  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Connection test failed.' }
  }
  return { ok: true, message: 'Bitrix24 connection verified (user.current).' }
}

/**
 * @param {{ webhookUrl?: string, apiToken?: string, dialogId: string, message: string }} params
 */
export async function sendBitrix24Message(params) {
  const dialogId = String(params.dialogId ?? '').trim()
  const message = String(params.message ?? '').trim()
  if (!dialogId) {
    return { ok: false, error: 'Dialog / chat ID is not configured.' }
  }
  if (!message) {
    return { ok: false, error: 'Message is empty.' }
  }

  const url = buildRestUrl(params.webhookUrl, 'im.message.add', params.apiToken)
  if (!url) {
    return { ok: false, error: 'Webhook URL or API token is required.' }
  }

  const result = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        DIALOG_ID: dialogId,
        MESSAGE: message,
      }),
    })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 300) }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `Bitrix24 returned HTTP ${res.status}` }
    }
    if (body?.error) {
      return {
        ok: false,
        status: res.status,
        body,
        error: String(body.error_description ?? body.error),
      }
    }
    return { ok: true, status: res.status, body, messageId: body?.result }
  })

  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Failed to send message.' }
  }
  return { ok: true, messageId: result.messageId }
}
