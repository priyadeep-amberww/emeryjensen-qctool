import fs from 'node:fs/promises'
import path from 'node:path'
import { safeStorage } from 'electron'
import { getStableCredentialsEnvPath } from './credentialsPath.mjs'

const ENC_PREFIX = 'enc:'

function envPath() {
  return getStableCredentialsEnvPath()
}

function parseEnvLines(content) {
  const map = new Map()
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    map.set(key, value)
  }
  return map
}

function serializeEnv(map) {
  const lines = [
    '# Grand QC Tool — credential store (secrets are encrypted at rest)',
    '# Managed by the Credentials page; do not paste secrets into logs.',
    '',
  ]
  const keys = [...map.keys()].sort()
  for (const key of keys) {
    lines.push(`${key}=${map.get(key)}`)
  }
  lines.push('')
  return lines.join('\n')
}

function encryptSecret(plain) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is not available on this machine.')
  }
  const encrypted = safeStorage.encryptString(plain)
  return `${ENC_PREFIX}${encrypted.toString('base64')}`
}

function decryptSecret(stored) {
  if (!stored.startsWith(ENC_PREFIX)) {
    return null
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is not available on this machine.')
  }
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

function isSecretStored(value) {
  return value.startsWith(ENC_PREFIX)
}

async function readMap() {
  try {
    const content = await fs.readFile(envPath(), 'utf8')
    return parseEnvLines(content)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return new Map()
    }
    throw err
  }
}

async function writeMap(map) {
  await fs.mkdir(path.dirname(envPath()), { recursive: true })
  await fs.writeFile(envPath(), serializeEnv(map), 'utf8')
}

/**
 * @param {string[]} envKeys
 * @returns {Promise<Record<string, { configured: boolean }>>}
 */
export async function getFieldStatus(envKeys) {
  const map = await readMap()
  const status = {}
  for (const key of envKeys) {
    const raw = map.get(key)
    if (!raw || String(raw).length === 0) {
      status[key] = { configured: false }
      continue
    }
    if (isSecretStored(raw) && decryptSecret(raw) == null) {
      status[key] = { configured: false }
      continue
    }
    status[key] = { configured: true }
  }
  return status
}

/**
 * Remove secrets encrypted under a previous Electron userData key.
 * Those blobs cannot be decrypted and would block the next save.
 */
export async function dropUndecryptableSecrets() {
  const map = await readMap()
  let changed = false
  for (const [key, raw] of map.entries()) {
    if (isSecretStored(raw) && decryptSecret(raw) == null) {
      map.delete(key)
      changed = true
    }
  }
  if (changed) {
    await writeMap(map)
  }
}

/**
 * @param {Record<string, string>} updates Plain values; omit or empty string skips update.
 * @param {string[]} secretKeys Env keys that must be encrypted at rest.
 */
export async function saveCredentialFields(updates, secretKeys) {
  const secretSet = new Set(secretKeys)
  const map = await readMap()

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === '') continue
    if (secretSet.has(key)) {
      map.set(key, encryptSecret(value))
    } else {
      map.set(key, value)
    }
  }

  await writeMap(map)
}

/**
 * @param {string[]} keys
 * @returns {Promise<Record<string, string>>}
 */
export async function getDecryptedValues(keys) {
  const map = await readMap()
  const out = {}
  for (const key of keys) {
    const raw = map.get(key)
    if (!raw) continue
    if (isSecretStored(raw)) {
      const plain = decryptSecret(raw)
      if (plain == null || plain === '') continue
      out[key] = plain
    } else {
      out[key] = raw
    }
  }
  return out
}

export async function encryptionAvailable() {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Plaintext credential fields safe to show in the UI (non-secrets only).
 * @param {Record<string, { fieldKeys: string[], secretKeys: string[] }>} registryGroups
 */
export async function getNonSecretDisplayValuesForGroups(registryGroups) {
  const map = await readMap()
  const groups = {}
  for (const [groupId, meta] of Object.entries(registryGroups)) {
    const secretSet = new Set(meta.secretKeys)
    groups[groupId] = {}
    for (const key of meta.fieldKeys) {
      if (secretSet.has(key)) continue
      const raw = map.get(key)
      if (raw && String(raw).length > 0) {
        groups[groupId][key] = String(raw)
      }
    }
  }
  return groups
}

/**
 * @param {string[]} keys
 */
export async function clearCredentialFields(keys) {
  const map = await readMap()
  let changed = false
  for (const key of keys) {
    if (map.has(key)) {
      map.delete(key)
      changed = true
    }
  }
  if (changed) {
    await writeMap(map)
  }
}
