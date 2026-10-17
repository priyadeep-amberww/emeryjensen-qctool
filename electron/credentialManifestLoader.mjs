import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let cached = null

export function loadCredentialManifest() {
  if (cached) return cached
  const manifestPath = path.join(__dirname, '../src/config/credentialManifest.json')
  const raw = fs.readFileSync(manifestPath, 'utf8')
  cached = JSON.parse(raw)
  return cached
}

export function buildCredentialRegistry(manifest) {
  const groups = {}
  const allKeys = new Set()
  const secretKeys = new Set()

  for (const group of manifest.groups) {
    const fieldKeys = group.fields.map((f) => f.storageKey)
    const groupSecrets = group.fields
      .filter((f) => f.secret || f.kind === 'secret' || f.kind === 'password')
      .map((f) => f.storageKey)

    groups[group.id] = {
      fieldKeys,
      secretKeys: groupSecrets,
      testHandler: group.testHandler,
      testConfig: group.testConfig ?? {},
      requiredKeys: group.fields.filter((f) => f.required !== false).map((f) => f.storageKey),
    }

    for (const key of fieldKeys) allKeys.add(key)
    for (const key of groupSecrets) secretKeys.add(key)
  }

  return { groups, allKeys: [...allKeys], secretKeys: [...secretKeys] }
}
