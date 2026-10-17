import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import { ConfirmDialog } from '../components/confirm'
import { useToast } from '../components/toast'
import { useSettings } from '../context/SettingsContext'
import { useAppTheme } from '../theme'
import { fontFamilyMono } from '../theme/typography'
import {
  QC_SIMILARITY_THRESHOLD_MAX,
  QC_SIMILARITY_THRESHOLD_MIN,
  ERROR_ENGINE_BACKOFF_MAX_MS,
  ERROR_ENGINE_BACKOFF_MIN_MS,
  ERROR_ENGINE_KEYS,
  ERROR_ENGINE_RETRY_MAX,
  ERROR_ENGINE_RETRY_MIN,
  QC_THRESHOLD_KEYS,
  SCRAPING_BEHAVIOR_KEYS,
  type AppSettings,
} from '../types/settings'
import { clampSimilarityThresholdPercent } from '../utils/settingsStorage'
import { useBitrix24Settings } from '../context/Bitrix24SettingsContext'
import { HaikuTokenCapSection } from '../components/settings/HaikuTokenCapSection'

const settingsToolbarBtnSx = {
  height: 32,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  borderRadius: 0.5,
  boxShadow: 'none',
  textTransform: 'uppercase',
} as const

const sectionPaperSx = {
  p: { xs: 1.75, sm: 2 },
  borderRadius: 0.5,
  border: '1px solid',
  borderColor: 'divider',
  width: '100%',
  boxSizing: 'border-box',
}

const sectionTitleSx = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'text.secondary',
}

const sectionDescSx = {
  fontSize: '12px',
  color: 'text.secondary',
  mt: 0.35,
  lineHeight: 1.55,
  maxWidth: '72ch',
}

const fieldSx = {
  '& .MuiInputBase-root': {
    borderRadius: 0.5,
    fontSize: '12px',
  },
  '& .MuiInputBase-input': {
    fontVariantNumeric: 'tabular-nums',
  },
}

const thresholdSliderSx = {
  mt: 0.25,
  mb: 0.5,
  px: 0.25,
  '& .MuiSlider-rail': {
    opacity: 1,
    height: 8,
    borderRadius: 4,
    bgcolor: 'action.selected',
  },
  '& .MuiSlider-track': {
    height: 8,
    borderRadius: 4,
    border: 'none',
  },
  '& .MuiSlider-root': {
    touchAction: 'none',
  },
  '& .MuiSlider-thumb': {
    width: 18,
    height: 18,
    border: '2px solid',
    borderColor: 'background.paper',
    boxShadow: 1,
    transition: 'box-shadow 150ms ease',
    '&:hover, &.Mui-focusVisible': {
      boxShadow: (theme: { palette: { mode: string } }) =>
        theme.palette.mode === 'dark'
          ? '0 0 0 7px rgba(59, 130, 246, 0.2)'
          : '0 0 0 7px rgba(37, 99, 235, 0.14)',
    },
  },
}

const THRESHOLD_LABELS: Record<(typeof QC_THRESHOLD_KEYS)[number], string> = {
  titleSimilarityPercent: 'Title Comparison Threshold',
  imageSimilarityPercent: 'Image Comparison Threshold',
}

const THRESHOLD_HINTS: Record<(typeof QC_THRESHOLD_KEYS)[number], string> = {
  titleSimilarityPercent:
    'Haiku titlePercent at or above this is YES. Below this is NO and fails that core check.',
  imageSimilarityPercent:
    'Haiku imagePercent at or above this is YES. Below this is NO and fails that core check.',
}

const BEHAVIOR_LABELS: Record<(typeof SCRAPING_BEHAVIOR_KEYS)[number], string> = {
  vendorLoginRequired: 'Vendor Login Required',
  reuseVendorSession: 'Reuse Vendor Session',
  headlessScraping: 'Headless Scraping',
}

const BEHAVIOR_HINTS: Record<(typeof SCRAPING_BEHAVIOR_KEYS)[number], string> = {
  vendorLoginRequired:
    'When on, the QC engine logs in before scraping (SWDT-style). When off, scraping runs without login (GLID-style).',
  reuseVendorSession:
    'Reuse an existing authenticated vendor session when available instead of logging in again for every run.',
  headlessScraping:
    'Run the vendor browser in headless mode. Turn off to show the browser window for login and scraping.',
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Paper sx={sectionPaperSx}>
      <Typography sx={sectionTitleSx}>{title}</Typography>
      {description ? <Typography sx={sectionDescSx}>{description}</Typography> : null}
      <Box sx={{ mt: description ? 1.75 : 1.25, width: '100%' }}>{children}</Box>
    </Paper>
  )
}

const QcThresholdSlider = memo(function QcThresholdSlider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const displayValue = dragValue ?? value

  useEffect(() => {
    if (!draggingRef.current) {
      setDragValue(null)
    }
  }, [value])

  const handleSliderChange = useCallback(
    (_: Event | SyntheticEvent, next: number | number[]) => {
      draggingRef.current = true
      setDragValue(clampSimilarityThresholdPercent(next as number, value))
    },
    [value],
  )

  const handleSliderChangeCommitted = useCallback(
    (_: Event | SyntheticEvent, next: number | number[]) => {
      draggingRef.current = false
      const nextValue = clampSimilarityThresholdPercent(next as number, value)
      setDragValue(null)
      if (nextValue !== value) {
        onChange(nextValue)
      }
    },
    [onChange, value],
  )

  return (
    <Box
      sx={{
        py: 1.25,
        px: 1.5,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 0.25,
        }}
      >
        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'text.primary', lineHeight: 1.35 }}>
          {label}
        </Typography>
        <Typography
          component="span"
          sx={{
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: fontFamilyMono,
            fontVariantNumeric: 'tabular-nums',
            color: 'primary.main',
            minWidth: 44,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {displayValue}%
        </Typography>
      </Box>
      <Slider
        value={displayValue}
        min={QC_SIMILARITY_THRESHOLD_MIN}
        max={QC_SIMILARITY_THRESHOLD_MAX}
        step={1}
        disableSwap
        aria-label={label}
        valueLabelDisplay="off"
        onChange={handleSliderChange}
        onChangeCommitted={handleSliderChangeCommitted}
        sx={thresholdSliderSx}
      />
      <Typography sx={{ fontSize: '11px', color: 'text.secondary', lineHeight: 1.5, mt: 0.25 }}>
        {hint}
      </Typography>
    </Box>
  )
})

function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    QC_THRESHOLD_KEYS.every((key) => a[key] === b[key]) &&
    SCRAPING_BEHAVIOR_KEYS.every((key) => a[key] === b[key]) &&
    ERROR_ENGINE_KEYS.every((key) => a[key] === b[key])
  )
}

function buildSettingsPatch(draft: AppSettings, saved: AppSettings): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {}
  for (const key of QC_THRESHOLD_KEYS) {
    if (draft[key] !== saved[key]) {
      patch[key] = draft[key]
    }
  }
  for (const key of SCRAPING_BEHAVIOR_KEYS) {
    if (draft[key] !== saved[key]) {
      patch[key] = draft[key]
    }
  }
  if (draft.errorEngineEnabled !== saved.errorEngineEnabled) {
    patch.errorEngineEnabled = draft.errorEngineEnabled
  }
  if (draft.errorEngineMaxRetries !== saved.errorEngineMaxRetries) {
    patch.errorEngineMaxRetries = draft.errorEngineMaxRetries
  }
  if (draft.errorEngineBackoffBaseMs !== saved.errorEngineBackoffBaseMs) {
    patch.errorEngineBackoffBaseMs = draft.errorEngineBackoffBaseMs
  }
  return patch
}

export function SettingsPage() {
  const { mode, setMode } = useAppTheme()
  const { settings, updateSettings, resetSettings } = useSettings()
  const { bitrix24, updateBitrix24 } = useBitrix24Settings()
  const { showToast } = useToast()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [draftSettings, setDraftSettings] = useState<AppSettings>(() => ({ ...settings }))
  const [draftThemeMode, setDraftThemeMode] = useState<'light' | 'dark'>(() => mode)

  useEffect(() => {
    setDraftSettings({ ...settings })
  }, [settings])

  useEffect(() => {
    setDraftThemeMode(mode)
  }, [mode])

  const isDirty = useMemo(
    () => !settingsEqual(draftSettings, settings) || draftThemeMode !== mode,
    [draftSettings, settings, draftThemeMode, mode],
  )

  const handleSaveSettings = useCallback(() => {
    const patch = buildSettingsPatch(draftSettings, settings)
    const themeChanged = draftThemeMode !== mode
    if (Object.keys(patch).length === 0 && !themeChanged) {
      showToast('No setting changes to save', 'info')
      return
    }

    if (Object.keys(patch).length > 0) {
      updateSettings(patch)
    }
    if (themeChanged) {
      setMode(draftThemeMode)
    }
    showToast('Settings saved', 'success')
  }, [draftSettings, settings, draftThemeMode, mode, updateSettings, setMode, showToast])

  const handleDiscard = useCallback(() => {
    setDraftSettings({ ...settings })
    setDraftThemeMode(mode)
    showToast('Unsaved changes discarded', 'info')
  }, [settings, mode, showToast])

  const thresholdFields = useMemo(
    () =>
      QC_THRESHOLD_KEYS.map((key) => ({
        key,
        label: THRESHOLD_LABELS[key],
        hint: THRESHOLD_HINTS[key],
        value: draftSettings[key],
      })),
    [draftSettings],
  )

  const thresholdChangeHandlers = useMemo(
    () =>
      Object.fromEntries(
        QC_THRESHOLD_KEYS.map((key) => [
          key,
          (value: number) => {
            setDraftSettings((prev) => {
              const next = clampSimilarityThresholdPercent(value, prev[key])
              if (prev[key] === next) return prev
              return { ...prev, [key]: next }
            })
          },
        ]),
      ) as Record<(typeof QC_THRESHOLD_KEYS)[number], (value: number) => void>,
    [],
  )

  const handleBehaviorChange = useCallback((key: (typeof SCRAPING_BEHAVIOR_KEYS)[number], checked: boolean) => {
    setDraftSettings((prev) => ({ ...prev, [key]: checked }))
  }, [])

  const handleErrorEngineToggle = useCallback((checked: boolean) => {
    setDraftSettings((prev) => ({ ...prev, errorEngineEnabled: checked }))
  }, [])

  const handleErrorEngineRetries = useCallback((raw: string) => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return
    const clamped = Math.min(ERROR_ENGINE_RETRY_MAX, Math.max(ERROR_ENGINE_RETRY_MIN, n))
    setDraftSettings((prev) => ({ ...prev, errorEngineMaxRetries: clamped }))
  }, [])

  const handleErrorEngineBackoff = useCallback((raw: string) => {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) return
    const clamped = Math.min(ERROR_ENGINE_BACKOFF_MAX_MS, Math.max(ERROR_ENGINE_BACKOFF_MIN_MS, n))
    setDraftSettings((prev) => ({ ...prev, errorEngineBackoffBaseMs: clamped }))
  }, [])

  return (
    <PageFrame
      title="Settings"
      subtitle="QC thresholds, scraping behavior, and appearance."
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            onClick={handleDiscard}
            disabled={!isDirty}
            sx={settingsToolbarBtnSx}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={!isDirty}
            sx={settingsToolbarBtnSx}
          >
            Save
          </Button>
        </Box>
      }
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
          minWidth: 0,
        }}
      >
        <SettingsSection
          title="APPEARANCE"
          description={`Theme is ${mode} when saved. The header toggle updates theme immediately; use Save to apply dropdown changes.`}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
              width: '100%',
            }}
          >
            <TextField
              select
              size="small"
              fullWidth
              label="Theme"
              value={draftThemeMode}
              onChange={(e) => setDraftThemeMode(e.target.value as 'light' | 'dark')}
              sx={fieldSx}
            >
              <MenuItem value="dark" sx={{ fontSize: '12px' }}>Dark</MenuItem>
              <MenuItem value="light" sx={{ fontSize: '12px' }}>Light</MenuItem>
            </TextField>
          </Box>
        </SettingsSection>

        <SettingsSection title="SCRAPING / PROCESSING BEHAVIOR">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 0,
              width: '100%',
            }}
          >
            {SCRAPING_BEHAVIOR_KEYS.map((key, index) => (
              <Box
                key={key}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  py: 1.5,
                  borderTop: index > 0 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  minWidth: 0,
                }}
              >
                <Switch
                  checked={draftSettings[key]}
                  onChange={(e) => handleBehaviorChange(key, e.target.checked)}
                  sx={{ mt: 0.1, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>
                    {BEHAVIOR_LABELS[key]}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.4, lineHeight: 1.55 }}>
                    {BEHAVIOR_HINTS[key]}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </SettingsSection>

        <HaikuTokenCapSection />

        <SettingsSection
          title="QC THRESHOLDS"
          description={`Title and image only. A Haiku percent at or above the slider is YES; below it is NO. Save stores these permanently (${QC_SIMILARITY_THRESHOLD_MIN}–${QC_SIMILARITY_THRESHOLD_MAX}%).`}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 2,
              width: '100%',
            }}
          >
            {thresholdFields.map((field) => (
              <QcThresholdSlider
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={field.value}
                onChange={thresholdChangeHandlers[field.key]}
              />
            ))}
          </Box>
        </SettingsSection>

        <SettingsSection
          title="BITRIX24"
          description="Global switch for outbound Bitrix24 notifications. Configure webhooks, triggers, and templates on the Bitrix24 page."
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Switch
              checked={bitrix24.enabled}
              onChange={(e) => updateBitrix24({ enabled: e.target.checked })}
              sx={{ mt: 0.1, flexShrink: 0 }}
            />
            <Box>
              <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Enable Bitrix24 notifications</Typography>
              <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.4, lineHeight: 1.55 }}>
                When off, QC Engine events are not sent to Bitrix24 regardless of per-trigger settings.
              </Typography>
            </Box>
          </Box>
        </SettingsSection>

        <SettingsSection
          title="ERROR ENGINE"
          description="Automatic scrape failure recovery: pause QC, cancel session, relogin with exponential backoff, then resume the batch."
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
              <Switch
                checked={draftSettings.errorEngineEnabled}
                onChange={(e) => handleErrorEngineToggle(e.target.checked)}
                sx={{ mt: 0.1, flexShrink: 0 }}
              />
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>Enable Error Engine</Typography>
                <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.4, lineHeight: 1.55 }}>
                  Vendor-agnostic recovery for network, timeout, and authentication scrape failures.
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Relogin attempts"
                value={draftSettings.errorEngineMaxRetries}
                onChange={(e) => handleErrorEngineRetries(e.target.value)}
                slotProps={{
                  htmlInput: {
                    min: ERROR_ENGINE_RETRY_MIN,
                    max: ERROR_ENGINE_RETRY_MAX,
                    step: 1,
                  },
                }}
                disabled={!draftSettings.errorEngineEnabled}
                sx={fieldSx}
                helperText={`${ERROR_ENGINE_RETRY_MIN}–${ERROR_ENGINE_RETRY_MAX} attempts`}
              />
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Backoff base (ms)"
                value={draftSettings.errorEngineBackoffBaseMs}
                onChange={(e) => handleErrorEngineBackoff(e.target.value)}
                slotProps={{
                  htmlInput: {
                    min: ERROR_ENGINE_BACKOFF_MIN_MS,
                    max: ERROR_ENGINE_BACKOFF_MAX_MS,
                    step: 100,
                  },
                }}
                disabled={!draftSettings.errorEngineEnabled}
                sx={fieldSx}
                helperText="Exponential delay between relogin retries"
              />
            </Box>
          </Box>
        </SettingsSection>

        <Paper
          sx={{
            ...sectionPaperSx,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 'min(100%, 480px)' } }}>
            <Typography sx={sectionTitleSx}>RESET SETTINGS</Typography>
            <Typography sx={{ ...sectionDescSx, maxWidth: 'none' }}>
              Restore QC thresholds and scraping behavior to their defaults.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => setResetConfirmOpen(true)}
            sx={{
              height: 32,
              minWidth: 132,
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: 0.5,
              flexShrink: 0,
              alignSelf: { xs: 'stretch', sm: 'center' },
            }}
          >
            Reset settings
          </Button>
        </Paper>
      </Box>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset settings to defaults?"
        message="This restores QC thresholds and scraping behavior on this device. Theme and export format are not changed."
        confirmLabel="Reset settings"
        cancelLabel="Keep current settings"
        confirmColor="error"
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={resetSettings}
      >
        <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 0.5, fontSize: '11px', py: 0.25 }}>
          Title Similarity 70% · Image Similarity 70% · Vendor Login Required ON · Error Engine ON (4 retries) ·
          Reuse Vendor Session ON ·
          Headless Scraping ON
        </Alert>
      </ConfirmDialog>
    </PageFrame>
  )
}
