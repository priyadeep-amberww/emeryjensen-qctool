import manifestJson from './credentialManifest.json'
import type {
  CredentialFieldDef,
  CredentialFieldStatus,
  CredentialGroupDef,
  CredentialManifest,
} from '../types/credentials'

export const CREDENTIAL_MANIFEST: CredentialManifest = manifestJson as CredentialManifest

export const CREDENTIAL_PAGE_SECTIONS = CREDENTIAL_MANIFEST.sections

export const CREDENTIAL_GROUPS: CredentialGroupDef[] = CREDENTIAL_MANIFEST.groups

export function getCredentialGroupById(id: string): CredentialGroupDef | undefined {
  return CREDENTIAL_GROUPS.find((g) => g.id === id)
}

export function resolveCredentialSections() {
  return CREDENTIAL_PAGE_SECTIONS.map((section) => ({
    section,
    group: getCredentialGroupById(section.groupId),
  })).filter((row): row is { section: typeof CREDENTIAL_PAGE_SECTIONS[number]; group: CredentialGroupDef } => Boolean(row.group))
}

export function isFieldSecret(field: CredentialFieldDef): boolean {
  return field.secret === true || field.kind === 'secret' || field.kind === 'password'
}

export function groupStorageKeys(group: CredentialGroupDef): string[] {
  return group.fields.map((f) => f.storageKey)
}

export function groupSecretStorageKeys(group: CredentialGroupDef): string[] {
  return group.fields.filter(isFieldSecret).map((f) => f.storageKey)
}

export function allManifestStorageKeys(): string[] {
  return [...new Set(CREDENTIAL_GROUPS.flatMap(groupStorageKeys))]
}

export function allManifestSecretStorageKeys(): string[] {
  return [...new Set(CREDENTIAL_GROUPS.flatMap(groupSecretStorageKeys))]
}

export function groupRequiredFields(group: CredentialGroupDef): CredentialFieldDef[] {
  return group.fields.filter((f) => f.required !== false)
}

/** True when every required field is saved or present in the current draft. */
export function groupHasRequiredValues(
  group: CredentialGroupDef,
  draft: Record<string, string>,
  fieldStatus: Record<string, CredentialFieldStatus>,
  editingSecrets: Record<string, boolean>,
): boolean {
  return groupRequiredFields(group).every((field) => {
    const key = field.storageKey
    if ((draft[key] ?? '').trim().length > 0) return true
    if (!fieldStatus[key]?.configured) return false
    if (isFieldSecret(field) && editingSecrets[key]) return false
    return true
  })
}

export function isGroupFullyConfigured(
  group: CredentialGroupDef,
  fieldStatus: Record<string, CredentialFieldStatus>,
): boolean {
  return groupRequiredFields(group).every((f) => fieldStatus[f.storageKey]?.configured)
}

export function groupHasAnyConfigured(
  group: CredentialGroupDef,
  fieldStatus: Record<string, CredentialFieldStatus>,
): boolean {
  return group.fields.some((f) => fieldStatus[f.storageKey]?.configured)
}
