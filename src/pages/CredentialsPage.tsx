import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import { CredentialGroupCard } from '../components/credentials/CredentialGroupCard'
import {
  CREDENTIAL_GROUPS,
  groupHasAnyConfigured,
  isGroupFullyConfigured,
  resolveCredentialSections,
} from '../config/credentialManifest'
import type { CredentialFieldStatus, CredentialGroupDef } from '../types/credentials'
import { useLogs } from '../context/LogsContext'
import {
  fetchCredentialDisplayValues,
  fetchCredentialsStatus,
  saveAllCredentials,
} from '../services/credentialsApi'
import { logCredentialEvent } from '../services/credentialLogging'
import type { CredentialsStatusResponse } from '../types/credentials'
import { useToast } from '../components/toast'
import { hasElectronCredentialsBridge, isElectronDesktop } from '../utils/electronBridge'

type GroupDrafts = Record<string, Record<string, string>>

const PAGE_SECTIONS = resolveCredentialSections()

function sectionStatus(group: CredentialGroupDef, fieldStatus: Record<string, CredentialFieldStatus>) {
  const fullyConfigured = isGroupFullyConfigured(group, fieldStatus)
  const anyConfigured = groupHasAnyConfigured(group, fieldStatus)
  if (fullyConfigured) return { label: 'Configured', color: 'success' as const }
  if (anyConfigured) return { label: 'Loaded', color: 'info' as const }
  if (group.optional) return { label: 'Optional', color: 'default' as const }
  return { label: 'Incomplete', color: 'default' as const }
}

function emptyDrafts(): GroupDrafts {
  const out: GroupDrafts = {}
  for (const group of CREDENTIAL_GROUPS) {
    out[group.id] = {}
  }
  return out
}

function mergeDisplayDrafts(display: Record<string, Record<string, string>>): GroupDrafts {
  const next = emptyDrafts()
  for (const group of CREDENTIAL_GROUPS) {
    next[group.id] = { ...(display[group.id] ?? {}) }
  }
  return next
}

export function CredentialsPage() {
  const { showToast } = useToast()
  const { appendLog } = useLogs()
  const [status, setStatus] = useState<CredentialsStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<GroupDrafts>(emptyDrafts)
  const [savingAll, setSavingAll] = useState(false)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [nextStatus, display] = await Promise.all([
        fetchCredentialsStatus(),
        fetchCredentialDisplayValues(),
      ])
      setStatus(nextStatus)
      setDrafts(mergeDisplayDrafts(display.groups))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const log = useCallback(
    (message: string, detail?: string, category?: 'CREDENTIALS' | 'LOGIN' | 'LOGIN SUCCESSFUL' | 'SESSION EXPIRED' | 'ERROR') => {
      logCredentialEvent(appendLog, message, detail, category ?? 'CREDENTIALS')
    },
    [appendLog],
  )

  const setDraftField = useCallback((groupId: string, storageKey: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [storageKey]: value },
    }))
  }, [])

  const clearGroupSecretDrafts = useCallback((groupId: string) => {
    const group = CREDENTIAL_GROUPS.find((g) => g.id === groupId)
    if (!group) return
    setDrafts((prev) => {
      const next = { ...prev[groupId] }
      for (const field of group.fields) {
        if (field.secret || field.kind === 'secret' || field.kind === 'password') {
          next[field.storageKey] = ''
        }
      }
      return { ...prev, [groupId]: next }
    })
  }, [])

  const saveAllCandidates = useMemo(() => {
    return CREDENTIAL_GROUPS.map((group) => {
      const values = drafts[group.id] ?? {}
      const hasValues = group.fields.some((f) => (values[f.storageKey] ?? '').trim().length > 0)
      return hasValues ? { groupId: group.id, values } : null
    }).filter((item): item is { groupId: string; values: Record<string, string> } => item !== null)
  }, [drafts])

  const handleSaveAll = async () => {
    if (saveAllCandidates.length === 0) {
      showToast('Enter values in at least one section before saving.', 'info')
      return
    }
    setSavingAll(true)
    try {
      const result = await saveAllCredentials(saveAllCandidates)
      for (const groupId of result.savedGroupIds) {
        clearGroupSecretDrafts(groupId)
      }
      if (result.savedGroupIds.length > 0) {
        showToast(`Saved ${result.savedGroupIds.length} credential section(s).`, 'success')
        log('Bulk credentials save', `Sections: ${result.savedGroupIds.length}`)
      }
      if (result.errors.length > 0) {
        showToast('Some sections could not be saved. See Logs for details.', 'error')
        for (const err of result.errors) {
          log('Bulk save failed', `${err.groupId}: ${err.error}`)
        }
      }
      await refresh(true)
    } finally {
      setSavingAll(false)
    }
  }

  const bridgeMissing = isElectronDesktop() && !hasElectronCredentialsBridge()

  return (
    <PageFrame
      title="Credentials"
      subtitle="SP-API and EJD portal credentials for capture and QC."
      actions={
        <Button
          variant="contained"
          size="small"
          disabled={savingAll || saveAllCandidates.length === 0}
          onClick={handleSaveAll}
          sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
        >
          {savingAll ? <CircularProgress size={16} color="inherit" /> : 'Save all'}
        </Button>
      }
    >
      {bridgeMissing && (
        <Alert severity="warning" sx={{ borderRadius: 0.5, fontSize: '12px', py: 0.25 }}>
          Credentials bridge did not load. Restart the desktop app.
        </Alert>
      )}

      {loading && !status ? (
        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>Loading credential status…</Typography>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          {PAGE_SECTIONS.map((row, index) => {
            const badge = sectionStatus(row.group, status?.groups[row.group.id] ?? {})
            return (
            <Paper
              key={row.section.id}
              sx={{ p: 1.5, borderRadius: 0.5, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography sx={{ fontSize: '13px', fontWeight: 700 }}>
                  {index + 1}. {row.section.title}
                </Typography>
                <Chip
                  size="small"
                  label={badge.label}
                  color={badge.color}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5, flexShrink: 0 }}
                />
              </Box>
              <CredentialGroupCard
                group={row.group}
                fieldStatus={status?.groups[row.group.id] ?? {}}
                draft={drafts[row.group.id] ?? {}}
                onDraftChange={(key, value) => setDraftField(row.group.id, key, value)}
                onDraftClearSecrets={() => clearGroupSecretDrafts(row.group.id)}
                onRefresh={() => void refresh(true)}
                onToast={(message, type) => showToast(message, type)}
                onLog={log}
                embeddedInSection
              />
            </Paper>
            )
          })}
        </Box>
      )}
    </PageFrame>
  )
}
