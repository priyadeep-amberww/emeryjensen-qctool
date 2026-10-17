import { ipcMain } from 'electron'
import { loadCredentialManifest, buildCredentialRegistry } from './credentialManifestLoader.mjs'
import { runCredentialTestHandler } from './credentialTestRegistry.mjs'
import {
  clearCredentialFields,
  encryptionAvailable,
  getDecryptedValues,
  getFieldStatus,
  getNonSecretDisplayValuesForGroups,
  saveCredentialFields,
} from './credentialsStore.mjs'

const manifest = loadCredentialManifest()
const registry = buildCredentialRegistry(manifest)

function groupMeta(groupId) {
  return registry.groups[groupId]
}

export function registerCredentialsIpc() {
  ipcMain.handle('credentials:encryptionAvailable', async () => encryptionAvailable())

  ipcMain.handle('credentials:getStatus', async () => {
    const fields = await getFieldStatus(registry.allKeys)
    const groups = {}
    for (const [groupId, meta] of Object.entries(registry.groups)) {
      groups[groupId] = {}
      for (const key of meta.fieldKeys) {
        groups[groupId][key] = fields[key] ?? { configured: false }
      }
    }
    return { groups, storage: 'electron-env', encryptionAvailable: await encryptionAvailable() }
  })

  ipcMain.handle('credentials:getDisplayValues', async () => {
    const groups = await getNonSecretDisplayValuesForGroups(registry.groups)
    return { groups }
  })

  ipcMain.handle('credentials:save', async (_event, payload) => {
    const groupId = payload?.groupId ?? payload?.vendorId
    const values = payload?.values
    if (!groupId || typeof values !== 'object' || values === null) {
      return { ok: false, error: 'Invalid save payload.' }
    }
    const meta = groupMeta(groupId)
    if (!meta) {
      return { ok: false, error: 'Unknown credential group.' }
    }

    const allowed = new Set(meta.fieldKeys)
    const updates = {}
    for (const [key, value] of Object.entries(values)) {
      if (!allowed.has(key)) continue
      if (typeof value !== 'string') continue
      if (value === '') continue
      updates[key] = value
    }

    if (Object.keys(updates).length === 0) {
      return { ok: false, error: 'Enter at least one value to save.' }
    }

    try {
      const existing = await getDecryptedValues(meta.fieldKeys)
      const merged = { ...existing, ...updates }
      const missing = meta.requiredKeys.filter((k) => !String(merged[k] ?? '').trim())
      if (missing.length > 0) {
        return { ok: false, error: 'Fill all required fields before saving.' }
      }
      await saveCredentialFields(updates, meta.secretKeys)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save credentials.'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('credentials:saveAll', async (_event, payload) => {
    const items = payload?.items
    if (!Array.isArray(items)) {
      return { ok: false, savedGroupIds: [], errors: [{ groupId: '', error: 'Invalid payload.' }] }
    }

    const savedGroupIds = []
    const errors = []

    for (const item of items) {
      const groupId = item?.groupId
      const values = item?.values
      if (!groupId || typeof values !== 'object') continue

      const meta = groupMeta(groupId)
      if (!meta) {
        errors.push({ groupId: String(groupId), error: 'Unknown credential group.' })
        continue
      }

      const allowed = new Set(meta.fieldKeys)
      const updates = {}
      for (const [key, value] of Object.entries(values)) {
        if (!allowed.has(key)) continue
        if (typeof value !== 'string' || value === '') continue
        updates[key] = value
      }

      if (Object.keys(updates).length === 0) continue

      try {
        const existing = await getDecryptedValues(meta.fieldKeys)
        const merged = { ...existing, ...updates }
        const missing = meta.requiredKeys.filter((k) => !String(merged[k] ?? '').trim())
        if (missing.length > 0) {
          errors.push({ groupId, error: 'Fill all required fields before saving.' })
          continue
        }
        await saveCredentialFields(updates, meta.secretKeys)
        savedGroupIds.push(groupId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed.'
        errors.push({ groupId, error: message })
      }
    }

    return {
      ok: errors.length === 0,
      savedGroupIds,
      errors,
    }
  })

  ipcMain.handle('credentials:clear', async (_event, payload) => {
    const groupId = payload?.groupId
    const meta = groupMeta(groupId)
    if (!meta) {
      return { ok: false, error: 'Unknown credential group.' }
    }
    try {
      await clearCredentialFields(meta.fieldKeys)
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear credentials.'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('credentials:test', async (_event, payload) => {
    const groupId = payload?.groupId ?? payload?.vendorId
    const meta = groupMeta(groupId)
    if (!meta) {
      return { ok: false, message: 'Unknown credential group.', log: [] }
    }

    try {
      const values = await getDecryptedValues(meta.fieldKeys)
      const missing = meta.requiredKeys.filter((k) => !String(values[k] ?? '').trim())
      if (missing.length > 0) {
        return {
          ok: false,
          message: 'Save required credentials before testing.',
          log: ['One or more required values are not stored yet.'],
        }
      }
      return await runCredentialTestHandler(meta.testHandler, values, meta.testConfig)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test failed.'
      return { ok: false, message, log: [message] }
    }
  })
}
