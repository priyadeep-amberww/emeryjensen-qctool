import {
  CREDENTIAL_GROUPS,
  getCredentialGroupById,
  groupStorageKeys,
  isFieldSecret,
} from '../config/credentialManifest'
import type {
  CredentialClearResult,
  CredentialSaveAllResult,
  CredentialSaveResult,
  CredentialsStatusResponse,
  CredentialTestResult,
  CredentialDisplayValuesResponse,
} from '../types/credentials'
import { hasElectronCredentialsBridge } from '../utils/electronBridge'

const FALLBACK_STORAGE_KEY = 'grand_qc_credentials_env'

function hasElectronCredentials(): boolean {
  return hasElectronCredentialsBridge()
}

function parseEnvLines(content: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim())
  }
  return map
}

function readFallbackMap(): Map<string, string> {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY)
    if (!raw) return new Map()
    return parseEnvLines(raw)
  } catch {
    return new Map()
  }
}

function writeFallbackMap(map: Map<string, string>) {
  const lines = ['# dev fallback — use desktop app for encrypted storage', '']
  const keys = [...map.keys()].sort()
  for (const key of keys) {
    lines.push(`${key}=${map.get(key)}`)
  }
  localStorage.setItem(FALLBACK_STORAGE_KEY, lines.join('\n'))
}

function fallbackGetAllDisplayValues(): CredentialDisplayValuesResponse['groups'] {
  const map = readFallbackMap()
  const groups: CredentialDisplayValuesResponse['groups'] = {}
  for (const group of CREDENTIAL_GROUPS) {
    groups[group.id] = {}
    for (const field of group.fields) {
      if (isFieldSecret(field)) continue
      const raw = map.get(field.storageKey)
      if (raw && !raw.startsWith('dev:')) {
        groups[group.id][field.storageKey] = raw
      }
    }
  }
  return groups
}

function readFallbackDecryptedMap(): Map<string, string> {
  const map = readFallbackMap()
  const out = new Map<string, string>()
  for (const [key, raw] of map.entries()) {
    if (raw.startsWith('dev:')) {
      try {
        out.set(key, atob(raw.slice(4)))
      } catch {
        /* ignore corrupt dev secret */
      }
    } else {
      out.set(key, raw)
    }
  }
  return out
}

function fallbackMergedValues(groupId: string, updates: Record<string, string>): Record<string, string> | null {
  const group = getCredentialGroupById(groupId)
  if (!group) return null
  const map = readFallbackDecryptedMap()
  const merged: Record<string, string> = {}
  for (const field of group.fields) {
    const stored = map.get(field.storageKey)
    if (stored) merged[field.storageKey] = stored
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value !== '') merged[key] = value
  }
  return merged
}

function fallbackRequiredMissing(groupId: string, merged: Record<string, string>): boolean {
  const group = getCredentialGroupById(groupId)
  if (!group) return true
  return group.fields
    .filter((f) => f.required !== false)
    .some((f) => !String(merged[f.storageKey] ?? '').trim())
}

function fallbackGetStatus(): CredentialsStatusResponse {
  const map = readFallbackMap()
  const groups: CredentialsStatusResponse['groups'] = {}
  for (const group of CREDENTIAL_GROUPS) {
    groups[group.id] = {}
    for (const field of group.fields) {
      const raw = map.get(field.storageKey)
      groups[group.id][field.storageKey] = { configured: Boolean(raw) }
    }
  }
  return { groups, storage: 'local-fallback', encryptionAvailable: false }
}

function fallbackSave(groupId: string, values: Record<string, string>): CredentialSaveResult {
  const group = getCredentialGroupById(groupId)
  if (!group) return { ok: false, error: 'Unknown credential group.' }

  const allowed = new Set(groupStorageKeys(group))
  const map = readFallbackMap()
  let touched = false

  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key) || value === '') continue
    const field = group.fields.find((f) => f.storageKey === key)
    if (field && isFieldSecret(field)) {
      map.set(key, `dev:${btoa(value)}`)
    } else {
      map.set(key, value)
    }
    touched = true
  }

  if (!touched) return { ok: false, error: 'Enter at least one value to save.' }

  const merged = fallbackMergedValues(groupId, values)
  if (!merged || fallbackRequiredMissing(groupId, merged)) {
    return { ok: false, error: 'Fill all required fields before saving.' }
  }

  writeFallbackMap(map)
  return { ok: true }
}

function fallbackClear(groupId: string): CredentialClearResult {
  const group = getCredentialGroupById(groupId)
  if (!group) return { ok: false, error: 'Unknown credential group.' }
  const map = readFallbackMap()
  for (const key of groupStorageKeys(group)) {
    map.delete(key)
  }
  writeFallbackMap(map)
  return { ok: true }
}

function fallbackSaveAll(
  items: { groupId: string; values: Record<string, string> }[],
): CredentialSaveAllResult {
  const savedGroupIds: string[] = []
  const errors: { groupId: string; error: string }[] = []

  for (const item of items) {
    const result = fallbackSave(item.groupId, item.values)
    if (result.ok) savedGroupIds.push(item.groupId)
    else if (result.error) errors.push({ groupId: item.groupId, error: result.error })
  }

  return { ok: errors.length === 0, savedGroupIds, errors }
}

function fallbackTest(): CredentialTestResult {
  return {
    ok: false,
    message: 'Connection tests run in the desktop app (Electron).',
    log: ['Use npm run dev for secure storage and live credential tests.'],
  }
}

export async function fetchCredentialsStatus(): Promise<CredentialsStatusResponse> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.getStatus()
  }
  return fallbackGetStatus()
}

export async function fetchCredentialDisplayValues(): Promise<CredentialDisplayValuesResponse> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.getDisplayValues()
  }
  return { groups: fallbackGetAllDisplayValues() }
}

export async function saveCredentials(
  groupId: string,
  values: Record<string, string>,
): Promise<CredentialSaveResult> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.save(groupId, values)
  }
  return fallbackSave(groupId, values)
}

export async function saveAllCredentials(
  items: { groupId: string; values: Record<string, string> }[],
): Promise<CredentialSaveAllResult> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.saveAll(items)
  }
  return fallbackSaveAll(items)
}

export async function clearCredentials(groupId: string): Promise<CredentialClearResult> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.clear(groupId)
  }
  return fallbackClear(groupId)
}

export async function testCredentials(groupId: string): Promise<CredentialTestResult> {
  if (hasElectronCredentials()) {
    return window.electronAPI!.credentials!.test(groupId)
  }
  return fallbackTest()
}
