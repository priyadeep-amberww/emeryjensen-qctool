import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { ConfirmDialog } from '../confirm'
import {
  groupHasAnyConfigured,
  groupHasRequiredValues,
  isFieldSecret,
  isGroupFullyConfigured,
} from '../../config/credentialManifest'
import type { CredentialFieldStatus, CredentialGroupDef } from '../../types/credentials'
import { clearCredentials, saveCredentials, testCredentials } from '../../services/credentialsApi'
import { exitVendorSession, reloginVendorSessionManual } from '../../services/vendorSession/vendorSessionApi'

const MASK = '••••••••'
const fieldSx = { '& .MuiInputBase-root': { borderRadius: 0.5, fontSize: '12px' } }

const CATEGORY_LABEL: Record<string, string> = {
  portal: 'Portal',
  amazon: 'Amazon',
  external_api: 'API',
  ai: 'AI',
  email: 'Email',
  integration: 'Integration',
  other: 'Other',
}

type Props = {
  group: CredentialGroupDef
  fieldStatus: Record<string, CredentialFieldStatus>
  draft: Record<string, string>
  onDraftChange: (storageKey: string, value: string) => void
  onDraftClearSecrets: () => void
  onRefresh: () => void
  onToast: (message: string, type: 'success' | 'error' | 'info') => void
  onLog: (message: string, detail?: string, category?: 'CREDENTIALS' | 'LOGIN' | 'LOGIN SUCCESSFUL' | 'SESSION EXPIRED' | 'ERROR') => void
  /** When true, section title is rendered by the parent Credentials page. */
  embeddedInSection?: boolean
}

export function CredentialGroupCard({
  group,
  fieldStatus,
  draft,
  onDraftChange,
  onDraftClearSecrets,
  onRefresh,
  onToast,
  onLog,
  embeddedInSection = false,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sessionBusy, setSessionBusy] = useState<'exit' | 'relogin' | null>(null)
  const [clearing, setClearing] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [editingSecrets, setEditingSecrets] = useState<Record<string, boolean>>({})
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({})
  const [, setTestLog] = useState<string[]>([])
  const showTest = Boolean(group.testActionLabel) && group.testHandler !== 'portal_reachability'
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testOk, setTestOk] = useState<boolean | null>(null)

  const fullyConfigured = useMemo(
    () => isGroupFullyConfigured(group, fieldStatus),
    [group, fieldStatus],
  )

  const anyConfigured = useMemo(
    () => groupHasAnyConfigured(group, fieldStatus),
    [group, fieldStatus],
  )

  const statusLabel = useMemo(() => {
    if (fullyConfigured) return 'Configured'
    if (anyConfigured) return 'Loaded'
    if (group.optional) return 'Optional'
    return 'Incomplete'
  }, [fullyConfigured, anyConfigured, group.optional])

  const statusColor = fullyConfigured ? 'success' : anyConfigured ? 'info' : 'default'

  const canTest = fullyConfigured

  const hasDraftValues = useMemo(
    () => group.fields.some((f) => (draft[f.storageKey] ?? '').trim().length > 0),
    [group, draft],
  )

  const hasRequiredForSave = useMemo(
    () => groupHasRequiredValues(group, draft, fieldStatus, editingSecrets),
    [group, draft, fieldStatus, editingSecrets],
  )

  const canSave = useMemo(() => {
    const hasChanges = hasDraftValues || Object.values(editingSecrets).some(Boolean)
    if (!hasChanges) return false
    return hasRequiredForSave
  }, [hasDraftValues, editingSecrets, hasRequiredForSave])

  const handleSave = async () => {
    if (!hasRequiredForSave) {
      onToast('Fill all required fields before saving.', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await saveCredentials(group.id, draft)
      if (!result.ok) {
        onToast(result.error ?? 'Could not save credentials.', 'error')
        onLog(`Save failed for ${group.name}`, result.error)
        return
      }
      onDraftClearSecrets()
      setEditingSecrets({})
      setVisibleValues({})
      onToast(`${group.name} saved.`, 'success')
      onLog(`Credentials saved`, group.name)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestLog([])
    setTestMessage(null)
    setTestOk(null)
    try {
      onLog(`Connection test started`, group.name)
      const result = await testCredentials(group.id)
      setTestLog(result.log)
      setTestMessage(result.message)
      setTestOk(result.ok)
      for (const line of result.log) {
        onLog(line, group.name, 'LOGIN')
      }
      onToast(result.message, result.ok ? 'success' : 'error')
      onLog(
        result.ok ? `Connection test succeeded` : `Connection test failed`,
        `${group.name} — ${result.message}`,
        result.ok ? 'LOGIN SUCCESSFUL' : 'ERROR',
      )
    } finally {
      setTesting(false)
    }
  }

  const handleExitSession = async () => {
    setSessionBusy('exit')
    try {
      onLog('Exit session requested', group.name, 'SESSION EXPIRED')
      const result = await exitVendorSession()
      for (const line of result.log ?? []) onLog(line, group.name, 'SESSION EXPIRED')
      if (!result.ok) {
        onToast(result.error ?? 'Could not exit the portal session.', 'error')
        onLog('Exit session failed', result.error, 'ERROR')
        return
      }
      onToast('Portal session closed.', 'info')
      onLog('Portal session closed', group.name, 'SESSION EXPIRED')
    } finally {
      setSessionBusy(null)
    }
  }

  const handleRelogin = async () => {
    setSessionBusy('relogin')
    try {
      onLog('Manual relogin started', group.name, 'LOGIN')
      const result = await reloginVendorSessionManual()
      for (const line of result.log ?? []) onLog(line, group.name, 'LOGIN')
      if (!result.ok) {
        onToast(result.error ?? 'Relogin failed.', 'error')
        onLog('Manual relogin failed', result.error, 'ERROR')
        return
      }
      onToast('Relogin succeeded. Portal session is armed.', 'success')
      onLog('Manual relogin succeeded', group.name, 'LOGIN SUCCESSFUL')
    } finally {
      setSessionBusy(null)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      const result = await clearCredentials(group.id)
      if (!result.ok) {
        onToast(result.error ?? 'Could not clear credentials.', 'error')
        onLog(`Clear failed for ${group.name}`, result.error)
        return
      }
      onDraftClearSecrets()
      setEditingSecrets({})
      setVisibleValues({})
      setTestLog([])
      setTestMessage(null)
      setTestOk(null)
      onToast(`${group.name} credentials cleared.`, 'info')
      onLog(`Credentials cleared`, group.name)
      onRefresh()
    } finally {
      setClearing(false)
    }
  }

  const fieldValue = useCallback(
    (field: CredentialGroupDef['fields'][number]) => {
      const key = field.storageKey
      const configured = fieldStatus[key]?.configured
      const secret = isFieldSecret(field)
      const raw = draft[key] ?? ''

      if (secret && configured && !editingSecrets[key] && raw === '') {
        return MASK
      }
      return raw
    },
    [draft, editingSecrets, fieldStatus],
  )

  const onFieldFocus = (field: CredentialGroupDef['fields'][number]) => {
    if (!isFieldSecret(field)) return
    const key = field.storageKey
    if (fieldStatus[key]?.configured && !editingSecrets[key]) {
      setEditingSecrets((prev) => ({ ...prev, [key]: true }))
      onDraftChange(key, '')
    }
  }

  const onFieldChange = (field: CredentialGroupDef['fields'][number], value: string) => {
    if (value === MASK) return
    onDraftChange(field.storageKey, value)
  }

  return (
    <Box
      sx={{
        p: embeddedInSection ? 0 : 2,
        borderRadius: 0.5,
        border: embeddedInSection ? 'none' : '1px solid',
        borderColor: 'divider',
        display: 'grid',
        gap: embeddedInSection ? 1 : 1.25,
      }}
    >
      {!embeddedInSection && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          {!embeddedInSection && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700 }}>{group.name}</Typography>
              <Chip
                size="small"
                label={CATEGORY_LABEL[group.category] ?? group.category}
                variant="outlined"
                sx={{ height: 20, fontSize: '9px', fontWeight: 700, borderRadius: 0.5 }}
              />
            </Box>
          )}
          {group.description ? (
            <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: embeddedInSection ? 0 : 0.25 }}>
              {group.description}
            </Typography>
          ) : null}
        </Box>
        <Chip
          size="small"
          label={statusLabel}
          color={statusColor}
          variant="outlined"
          sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
        />
      </Box>
      )}

      <Box sx={{ display: 'grid', gap: 1 }}>
        {group.fields.map((field) => {
          const secret = isFieldSecret(field)
          const display = fieldValue(field)
          const masked = secret && display === MASK
          const key = field.storageKey
          const showValue = Boolean(visibleValues[key])
          const inputType = secret && !showValue ? 'password' : field.kind === 'email' ? 'email' : 'text'

          return (
            <TextField
              key={field.storageKey}
              fullWidth
              size="small"
              label={field.required === false ? `${field.label} (optional)` : field.label}
              type={inputType}
              autoComplete="off"
              placeholder={field.placeholder}
              value={display}
              onFocus={() => onFieldFocus(field)}
              onChange={(e) => onFieldChange(field, e.target.value)}
              sx={fieldSx}
              slotProps={{
                input: secret
                  ? {
                      readOnly: masked,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            edge="end"
                            aria-label={showValue ? 'Hide value' : 'Show value'}
                            onClick={() =>
                              setVisibleValues((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            onMouseDown={(e) => e.preventDefault()}
                          >
                            {showValue ? (
                              <VisibilityOff sx={{ fontSize: 18 }} />
                            ) : (
                              <Visibility sx={{ fontSize: 18 }} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  : masked
                    ? { readOnly: true }
                    : undefined,
              }}
            />
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          disabled={saving || !canSave}
          onClick={handleSave}
          sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
        >
          {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
        </Button>
        {showTest && (
          <Button
            variant="outlined"
            size="small"
            disabled={testing || !canTest || sessionBusy !== null}
            onClick={handleTest}
            sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
          >
            {testing ? <CircularProgress size={16} /> : group.testActionLabel}
          </Button>
        )}
        {group.id === 'vendor_portal' && (
          <>
            <Button
              variant="outlined"
              size="small"
              disabled={sessionBusy !== null || testing}
              onClick={() => void handleRelogin()}
              sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
            >
              {sessionBusy === 'relogin' ? <CircularProgress size={16} /> : 'Attempt relogin'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              disabled={sessionBusy !== null || testing}
              onClick={() => void handleExitSession()}
              sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
            >
              {sessionBusy === 'exit' ? <CircularProgress size={16} /> : 'Exit session'}
            </Button>
          </>
        )}
        <Button
          variant="outlined"
          size="small"
          color="error"
          disabled={clearing || !anyConfigured}
          onClick={() => setClearConfirmOpen(true)}
          sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
        >
          {clearing ? <CircularProgress size={16} /> : 'Forget'}
        </Button>
      </Box>

      {testMessage && (
        <Alert
          severity={testOk ? 'success' : 'error'}
          sx={{ borderRadius: 0.5, py: 0.25, '& .MuiAlert-message': { fontSize: '12px', fontWeight: 600 } }}
        >
          {testMessage}
        </Alert>
      )}

      <ConfirmDialog
        open={clearConfirmOpen}
        title={`Forget ${group.name} credentials?`}
        message="Saved values for this section will be removed from this device."
        confirmLabel="Forget credentials"
        cancelLabel="Keep saved"
        confirmColor="error"
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClear}
      />
    </Box>
  )
}
