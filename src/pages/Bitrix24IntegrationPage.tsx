import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import { CredentialGroupCard } from '../components/credentials/CredentialGroupCard'
import { useToast } from '../components/toast'
import { getCredentialGroupById } from '../config/credentialManifest'
import { useBitrix24Settings } from '../context/Bitrix24SettingsContext'
import { useLogs } from '../context/LogsContext'
import { BITRIX24_TRIGGER_IDS } from '../services/bitrix24/defaultTemplates'
import { sendBitrix24Message, testBitrix24Connection } from '../services/bitrix24/bitrix24Api'
import { renderBitrix24Template } from '../services/bitrix24/templateRenderer'
import { buildQcEventPayload } from '../services/qc/qcEngineEventBus'
import {
  fetchCredentialDisplayValues,
  fetchCredentialsStatus,
} from '../services/credentialsApi'
import { logCredentialEvent } from '../services/credentialLogging'
import type { CredentialsStatusResponse } from '../types/credentials'
import {
  BITRIX24_TEMPLATE_VARIABLES,
  BITRIX24_TRIGGER_LABELS,
  type Bitrix24TriggerId,
} from '../types/bitrix24'
import { hasElectronCredentialsBridge, isElectronDesktop } from '../utils/electronBridge'
import { fontFamilyMono } from '../theme/typography'

const BITRIX_GROUP_ID = 'bitrix24'

const sectionPaperSx = {
  p: { xs: 1.75, sm: 2 },
  borderRadius: 0.5,
  border: '1px solid',
  borderColor: 'divider',
  width: '100%',
  boxSizing: 'border-box',
} as const

const fieldSx = {
  '& .MuiInputBase-root': { borderRadius: 0.5, fontSize: '12px' },
} as const

const SAMPLE_PREVIEW_PAYLOAD = buildQcEventPayload({
  batchLabel: 'QC-001',
  completedCount: 42,
  passCount: 36,
  total: 100,
  status: 'running',
  startedAt: Date.now() - 45 * 60 * 1000,
  error_message: 'Example scrape timeout',
})

export function Bitrix24IntegrationPage() {
  const { showToast } = useToast()
  const { appendLog } = useLogs()
  const { bitrix24, updateBitrix24, resetBitrix24 } = useBitrix24Settings()
  const bitrixGroup = getCredentialGroupById(BITRIX_GROUP_ID)

  const [status, setStatus] = useState<CredentialsStatusResponse | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [credLoading, setCredLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [selectedTrigger, setSelectedTrigger] = useState<Bitrix24TriggerId>('batchComplete')

  const refreshCredentials = useCallback(async () => {
    setCredLoading(true)
    try {
      const [nextStatus, display] = await Promise.all([
        fetchCredentialsStatus(),
        fetchCredentialDisplayValues(),
      ])
      setStatus(nextStatus)
      setDraft({ ...(display.groups[BITRIX_GROUP_ID] ?? {}) })
    } finally {
      setCredLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshCredentials()
  }, [refreshCredentials])

  const fieldStatus = status?.groups[BITRIX_GROUP_ID] ?? {}

  const previewMessage = useMemo(() => {
    const template = bitrix24.templates[selectedTrigger]
    const payload = {
      ...SAMPLE_PREVIEW_PAYLOAD,
      event: 'onBatchComplete' as const,
      completed_count: 50,
      pass_rate: 88,
    }
    return renderBitrix24Template(template, payload)
  }, [bitrix24.templates, selectedTrigger])

  const handleTestConnection = useCallback(async () => {
    setTestingConnection(true)
    try {
      const result = await testBitrix24Connection()
      if (result.ok) {
        showToast(result.message ?? 'Bitrix24 connection verified', 'success')
        logCredentialEvent(appendLog, 'Bitrix24 connection test succeeded')
      } else {
        showToast(result.error, 'error')
        logCredentialEvent(appendLog, 'Bitrix24 connection test failed', result.error)
      }
    } finally {
      setTestingConnection(false)
    }
  }, [showToast, appendLog])

  const handleSendTestMessage = useCallback(async () => {
    setSendingTest(true)
    try {
      const message = renderBitrix24Template(bitrix24.templates.batchComplete, {
        ...SAMPLE_PREVIEW_PAYLOAD,
        event: 'onBatchComplete',
        completed_count: 12,
        total_count: 12,
        pass_rate: 92,
        status: 'done',
      })
      const result = await sendBitrix24Message({ message })
      if (result.ok) {
        showToast('Test message sent to Bitrix24', 'success')
      } else {
        showToast(result.error, 'error')
      }
    } finally {
      setSendingTest(false)
    }
  }, [bitrix24.templates.batchComplete, showToast])

  if (!bitrixGroup) {
    return (
      <PageFrame title="Bitrix24 Integration" subtitle="Configuration missing from credential manifest.">
        <Alert severity="error">Bitrix24 credential group is not defined.</Alert>
      </PageFrame>
    )
  }

  return (
    <PageFrame
      title="Bitrix24 Integration"
      subtitle="Outbound notifications to your Bitrix24 workspace when QC batches run."
      actions={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => resetBitrix24()}
            sx={{ fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
          >
            Reset templates
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        {!isElectronDesktop() && (
          <Alert severity="warning" sx={{ borderRadius: 0.5, fontSize: '12px' }}>
            Bitrix24 delivery requires the Electron desktop app (secure credentials + IPC).
          </Alert>
        )}

        <Paper sx={sectionPaperSx}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Switch
              checked={bitrix24.enabled}
              onChange={(e) => updateBitrix24({ enabled: e.target.checked })}
              sx={{ mt: 0.1 }}
            />
            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Enable Bitrix24 notifications</Typography>
              <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.4, lineHeight: 1.55 }}>
                When on, QC Engine events send messages using your templates and triggers below.
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper sx={sectionPaperSx}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            API CREDENTIALS
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.35, mb: 1.5, lineHeight: 1.55 }}>
            Stored encrypted in credentials.env (same store as Amazon SP-API).
          </Typography>
          {credLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : hasElectronCredentialsBridge() && status ? (
            <CredentialGroupCard
              group={bitrixGroup}
              fieldStatus={fieldStatus}
              draft={draft}
              onDraftChange={(key, value) => setDraft((prev) => ({ ...prev, [key]: value }))}
              onDraftClearSecrets={() => {
                const secretKeys = bitrixGroup.fields.filter((f) => f.secret).map((f) => f.storageKey)
                setDraft((prev) => {
                  const next = { ...prev }
                  for (const k of secretKeys) delete next[k]
                  return next
                })
              }}
              onRefresh={refreshCredentials}
              onToast={showToast}
              onLog={(message, detail) => logCredentialEvent(appendLog, message, detail)}
              embeddedInSection
            />
          ) : (
            <Alert severity="info" sx={{ fontSize: '12px' }}>
              Open the desktop app to configure Bitrix24 credentials.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Button
              variant="contained"
              size="small"
              disabled={testingConnection || !isElectronDesktop()}
              onClick={() => void handleTestConnection()}
              sx={{ fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
            >
              {testingConnection ? 'Testing…' : 'Test connection'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={sendingTest || !isElectronDesktop()}
              onClick={() => void handleSendTestMessage()}
              sx={{ fontSize: '11px', fontWeight: 600, borderRadius: 0.5 }}
            >
              {sendingTest ? 'Sending…' : 'Send test message'}
            </Button>
          </Box>
        </Paper>

        <Paper sx={sectionPaperSx}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            NOTIFICATION TRIGGERS
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {BITRIX24_TRIGGER_IDS.map((id, index) => (
              <Box
                key={id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  py: 1.25,
                  borderTop: index > 0 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Switch
                  checked={bitrix24.triggers[id]}
                  onChange={(e) =>
                    updateBitrix24({
                      triggers: { ...bitrix24.triggers, [id]: e.target.checked },
                    })
                  }
                  sx={{ mt: 0.1 }}
                />
                <Typography sx={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>
                  {BITRIX24_TRIGGER_LABELS[id]}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
              mt: 2,
            }}
          >
            <TextField
              size="small"
              type="number"
              label="Progress every N SKUs"
              value={bitrix24.progressSkuInterval}
              onChange={(e) =>
                updateBitrix24({ progressSkuInterval: Number.parseInt(e.target.value, 10) })
              }
              slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
              sx={fieldSx}
            />
            <TextField
              select
              size="small"
              label="Periodic status interval"
              value={bitrix24.periodicStatusMinutes}
              onChange={(e) =>
                updateBitrix24({ periodicStatusMinutes: Number.parseInt(e.target.value, 10) })
              }
              sx={fieldSx}
            >
              <MenuItem value={30} sx={{ fontSize: '12px' }}>Every 30 minutes</MenuItem>
              <MenuItem value={60} sx={{ fontSize: '12px' }}>Every 60 minutes</MenuItem>
              <MenuItem value={15} sx={{ fontSize: '12px' }}>Every 15 minutes</MenuItem>
            </TextField>
          </Box>
        </Paper>

        <Paper sx={sectionPaperSx}>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            MESSAGE TEMPLATES
          </Typography>
          <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
            Variables: {BITRIX24_TEMPLATE_VARIABLES.join(', ')}
          </Typography>
          <TextField
            select
            size="small"
            fullWidth
            label="Edit template for"
            value={selectedTrigger}
            onChange={(e) => setSelectedTrigger(e.target.value as Bitrix24TriggerId)}
            sx={{ ...fieldSx, mb: 1.5 }}
          >
            {BITRIX24_TRIGGER_IDS.map((id) => (
              <MenuItem key={id} value={id} sx={{ fontSize: '12px' }}>
                {BITRIX24_TRIGGER_LABELS[id]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={4}
            label="Template"
            value={bitrix24.templates[selectedTrigger]}
            onChange={(e) =>
              updateBitrix24({
                templates: { ...bitrix24.templates, [selectedTrigger]: e.target.value },
              })
            }
            sx={fieldSx}
          />
          <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'text.secondary', mt: 2, mb: 0.75 }}>
            Preview
          </Typography>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              fontFamily: fontFamilyMono,
              fontSize: '11px',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.55,
            }}
          >
            {previewMessage}
          </Box>
        </Paper>
      </Box>
    </PageFrame>
  )
}
