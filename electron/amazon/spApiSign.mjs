import crypto from 'node:crypto'
import { SP_API_REGION } from './spApiCredentialKeys.mjs'

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding)
}

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * @param {{ accessKeyId: string, secretAccessKey: string, roleArn: string, sessionName?: string }} params
 */
export async function assumeSpApiRole(params) {
  const accessKeyId = params.accessKeyId?.trim()
  const secretAccessKey = params.secretAccessKey?.trim()
  const roleArn = params.roleArn?.trim()
  const sessionName = (params.sessionName ?? 'grand-qc-sp-api').slice(0, 64)

  if (!accessKeyId || !secretAccessKey || !roleArn) {
    return {
      ok: false,
      error:
        'Missing AWS signing credentials. Save AWS access key, secret access key, and role ARN on the Credentials page.',
    }
  }

  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)
  const host = 'sts.amazonaws.com'
  const method = 'POST'
  const canonicalUri = '/'
  const query = new URLSearchParams({
    Action: 'AssumeRole',
    Version: '2011-06-15',
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    DurationSeconds: '3600',
  })
  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&')

  const payload = ''
  const canonicalHeaders =
    `host:${host}\n` + `x-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-date'
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n')

  const credentialScope = `${dateStamp}/${SP_API_REGION}/sts/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, SP_API_REGION)
  const kService = hmac(kRegion, 'sts')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign, 'hex')

  const authorization = [
    'AWS4-HMAC-SHA256 Credential=',
    `${accessKeyId}/${credentialScope}`,
    `, SignedHeaders=${signedHeaders}`,
    `, Signature=${signature}`,
  ].join('')

  const url = `https://${host}/?${canonicalQuery}`
  const res = await fetch(url, {
    method,
    headers: {
      Host: host,
      'X-Amz-Date': amzDate,
      Authorization: authorization,
    },
  })

  const text = await res.text()
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200)
    return { ok: false, error: `AWS AssumeRole failed (HTTP ${res.status}): ${snippet}` }
  }

  const accessKeyMatch = text.match(/<AccessKeyId>([^<]+)<\/AccessKeyId>/)
  const secretMatch = text.match(/<SecretAccessKey>([^<]+)<\/SecretAccessKey>/)
  const tokenMatch = text.match(/<SessionToken>([^<]+)<\/SessionToken>/)
  if (!accessKeyMatch || !secretMatch || !tokenMatch) {
    return { ok: false, error: 'AWS AssumeRole response did not include session credentials.' }
  }

  return {
    ok: true,
    credentials: {
      accessKeyId: accessKeyMatch[1],
      secretAccessKey: secretMatch[1],
      sessionToken: tokenMatch[1],
    },
  }
}

/**
 * @param {{ method: string, host: string, path: string, query?: string, body?: string, accessToken: string, credentials: { accessKeyId: string, secretAccessKey: string, sessionToken: string } }} opts
 */
export function signSpApiRequest(opts) {
  const method = opts.method.toUpperCase()
  const host = opts.host
  const canonicalUri = opts.path.startsWith('/') ? opts.path : `/${opts.path}`
  const canonicalQuery = opts.query ?? ''
  const payload = opts.body ?? ''
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-access-token:${opts.accessToken}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-security-token:${opts.credentials.sessionToken}\n`
  const signedHeaders = 'host;x-amz-access-token;x-amz-date;x-amz-security-token'
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n')

  const credentialScope = `${dateStamp}/${SP_API_REGION}/execute-api/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')

  const kDate = hmac(`AWS4${opts.credentials.secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, SP_API_REGION)
  const kService = hmac(kRegion, 'execute-api')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign, 'hex')

  const authorization = [
    'AWS4-HMAC-SHA256 Credential=',
    `${opts.credentials.accessKeyId}/${credentialScope}`,
    `, SignedHeaders=${signedHeaders}`,
    `, Signature=${signature}`,
  ].join('')

  return {
    url: `https://${host}${canonicalUri}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    headers: {
      Host: host,
      'x-amz-access-token': opts.accessToken,
      'x-amz-date': amzDate,
      'x-amz-security-token': opts.credentials.sessionToken,
      Authorization: authorization,
      'User-Agent': 'GrandQcTool/1.0 (Language=Node)',
    },
  }
}
