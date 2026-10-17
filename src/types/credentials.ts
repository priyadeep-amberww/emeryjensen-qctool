export type CredentialFieldKind = 'secret' | 'password' | 'text' | 'url' | 'email'

export type CredentialGroupCategory = 'portal' | 'amazon' | 'external_api' | 'ai' | 'email' | 'other'

export interface CredentialPageSectionDef {
  id: string
  title: string
  subtitle?: string
  groupId: string
}

export type CredentialStorageProfile = 'encrypted_env'

export interface CredentialFieldDef {
  storageKey: string
  label: string
  kind: CredentialFieldKind
  placeholder?: string
  required?: boolean
  /** When true, value is encrypted at rest in Electron. */
  secret?: boolean
}

export interface CredentialGroupDef {
  id: string
  name: string
  description: string
  category: CredentialGroupCategory
  /** Entire group can be optional for this QC tool deployment. */
  optional?: boolean
  testActionLabel: string
  /** Maps to a handler in `electron/credentialTestRegistry.mjs`. */
  testHandler: string
  testConfig?: Record<string, string>
  storageProfile?: CredentialStorageProfile
  fields: CredentialFieldDef[]
}

export interface CredentialManifest {
  version: number
  /** Ordered page sections — each maps to one credential group. */
  sections: CredentialPageSectionDef[]
  groups: CredentialGroupDef[]
}

export type CredentialFieldStatus = { configured: boolean }

export type CredentialsStatusResponse = {
  groups: Record<string, Record<string, CredentialFieldStatus>>
  storage: 'electron-env' | 'local-fallback'
  encryptionAvailable: boolean
}

export type CredentialSaveResult = { ok: boolean; error?: string }

export type CredentialTestResult = {
  ok: boolean
  message: string
  log: string[]
}

export type CredentialClearResult = { ok: boolean; error?: string }

export type CredentialSaveAllResult = {
  ok: boolean
  savedGroupIds: string[]
  errors: { groupId: string; error: string }[]
}

export type CredentialDisplayValuesResponse = {
  groups: Record<string, Record<string, string>>
}
