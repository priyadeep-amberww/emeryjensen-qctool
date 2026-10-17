import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { PageFrame } from '../components/layout/PageFrame'
import { InputFieldChipSelect } from '../components/input/InputFieldChipSelect'
import { RawScrapeComparePair, SandboxQcComparisons } from '../components/sandbox'
import { QcVerdictChip } from '../components/status'
import { useToast } from '../components/toast'
import { useAiUsage } from '../context/AiUsageContext'
import { useLogs } from '../context/LogsContext'
import { useBrandAliases } from '../context/BrandAliasContext'
import { useSettings } from '../context/SettingsContext'
import { useAppTheme } from '../theme'
import { fontFamilyMono } from '../theme/typography'
import {
  AVAILABLE_INPUT_FIELDS,
  fieldsFromIds,
  loadSavedFieldIds,
  loadSandboxFieldIds,
  saveSandboxFieldIds,
  type InputFieldDef,
} from '../data/inputFields'
import {
  buildSandboxQcResult,
  buildSandboxTerminalScript,
  type SandboxQcResult,
  type SandboxTerminalLine,
} from '../data/sandboxQc'
import { VENDOR_INTEGRATION_ID } from '../config/vendorIntegration'
import { listingQcPayloadToSandboxQcResult } from '../services/qc/listingQcMapper'
import { formatUsd } from '../utils/aiPricing'
import { getLogCategoryTone } from '../utils/logCategoryStyles'
import {
  buildSandboxSampleValues,
  buildSandboxValuesPlaceholder,
  parseSandboxValuesOnly,
} from '../utils/sandboxParse'

const COLUMN_WIDTH_CH = 14

/** Single-SKU paste — fixed one-line height so the row never gets clipped under the terminal. */
const pasteInputSx = {
  width: '100%',
  bgcolor: 'background.paper',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiInputBase-root': {
    width: '100%',
    fontFamily: fontFamilyMono,
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: 0,
    alignItems: 'center',
    bgcolor: 'background.paper',
    color: 'text.primary',
    tabSize: COLUMN_WIDTH_CH,
    MozTabSize: COLUMN_WIDTH_CH,
    minHeight: 40,
  },
  '& .MuiInputBase-input': {
    width: '100% !important',
    boxSizing: 'border-box',
    px: 1.5,
    py: 1.15,
    lineHeight: 1.45,
    whiteSpace: 'pre',
    overflowX: 'auto',
    overflowY: 'hidden',
    bgcolor: 'background.paper',
    color: 'text.primary',
    tabSize: COLUMN_WIDTH_CH,
    MozTabSize: COLUMN_WIDTH_CH,
    WebkitTextFillColor: 'inherit',
    '&.Mui-disabled': {
      WebkitTextFillColor: 'inherit',
      opacity: 0.9,
    },
  },
} as const

const TabularColumnHeader = memo(function TabularColumnHeader({
  fields,
}: {
  fields: InputFieldDef[]
}) {
  if (fields.length === 0) return null
  const tableWidthCh = fields.length * COLUMN_WIDTH_CH
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: `${tableWidthCh}ch`,
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontFamily: fontFamilyMono,
          fontSize: '11px',
          '& th': {
            width: `${COLUMN_WIDTH_CH}ch`,
            maxWidth: `${COLUMN_WIDTH_CH}ch`,
            fontFamily: fontFamilyMono,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            lineHeight: 1.5,
            textAlign: 'left',
            verticalAlign: 'middle',
            // Muted label — clearly distinct from the brighter paste values below
            color: 'text.secondary',
            px: 0,
            py: 0.85,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }}
      >
        <Box component="colgroup">
          {fields.map((field) => (
            <Box component="col" key={field.id} sx={{ width: `${COLUMN_WIDTH_CH}ch` }} />
          ))}
        </Box>
        <Box component="thead">
          <Box component="tr">
            {fields.map((field) => (
              <Box component="th" key={field.id} scope="col" title={field.label}>
                {field.label}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
})

const TerminalLineRow = memo(function TerminalLineRow({
  line,
  isDark,
}: {
  line: SandboxTerminalLine
  isDark: boolean
}) {
  const tone = getLogCategoryTone(line.level, isDark)
  const time = new Date(line.at).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <Box
      className="animate-fade-in"
      sx={{
        display: 'grid',
        gridTemplateColumns: '64px 88px minmax(0, 1fr)',
        gap: 1,
        alignItems: 'start',
        px: 1.25,
        py: 0.55,
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'divider',
        fontFamily: fontFamilyMono,
        fontSize: '11px',
        lineHeight: 1.45,
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: '11px', fontFamily: fontFamilyMono, color: 'text.secondary', whiteSpace: 'nowrap' }}
      >
        {time}
      </Typography>
      <Chip
        size="small"
        label={line.level}
        sx={{
          height: 18,
          maxWidth: '100%',
          fontSize: '9px',
          fontWeight: 700,
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: tone.border,
          bgcolor: tone.bg,
          color: tone.text,
          '& .MuiChip-label': { px: 0.6 },
        }}
      />
      <Typography
        sx={{
          fontSize: '11px',
          fontFamily: fontFamilyMono,
          color: isDark ? '#e4e4e7' : 'text.primary',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {line.text}
      </Typography>
    </Box>
  )
})

export function SandboxPage() {
  const { showToast } = useToast()
  const { recordUsage } = useAiUsage()
  const { appendLog } = useLogs()
  const { settings } = useSettings()
  const { aliasPairs } = useBrandAliases()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  const [draftIds, setDraftIds] = useState<string[]>(() => loadSandboxFieldIds())
  const [savedIds, setSavedIds] = useState<string[]>(() => loadSandboxFieldIds())
  const savedFields = useMemo(() => fieldsFromIds(savedIds), [savedIds])

  const initialPaste = useMemo(
    () => buildSandboxSampleValues(fieldsFromIds(loadSandboxFieldIds())),
    [],
  )
  const [pasteDefault, setPasteDefault] = useState(initialPaste)
  const [pasteResetKey, setPasteResetKey] = useState(0)
  const pasteInputRef = useRef<HTMLTextAreaElement | null>(null)
  const pasteTextRef = useRef(initialPaste)

  const [errors, setErrors] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [terminalLines, setTerminalLines] = useState<SandboxTerminalLine[]>([])
  const [qcResult, setQcResult] = useState<SandboxQcResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  const terminalRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<number[]>([])
  const runGenRef = useRef(0)

  const draftDirty = useMemo(
    () => draftIds.join('\0') !== savedIds.join('\0'),
    [draftIds, savedIds],
  )

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    const el = terminalRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [terminalLines])

  const syncPasteText = useCallback(() => {
    const el = pasteInputRef.current
    if (el) pasteTextRef.current = el.value
  }, [])

  const toggleDraft = useCallback((id: string) => {
    setDraftIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }, [])

  const applySavedFields = useCallback(
    (ordered: string[], toastMessage: string) => {
      saveSandboxFieldIds(ordered)
      setSavedIds(ordered)
      setDraftIds(ordered)
      const nextFields = fieldsFromIds(ordered)
      const sample = buildSandboxSampleValues(nextFields)
      pasteTextRef.current = sample
      setPasteDefault(sample)
      setPasteResetKey((k) => k + 1)
      setErrors([])
      setQcResult(null)
      setShowResults(false)
      setTerminalLines([])
      showToast(toastMessage, 'success')
    },
    [showToast],
  )

  const handleSaveFields = () => {
    if (draftIds.length === 0) {
      showToast('Select at least one field', 'warning')
      return
    }
    const ordered = draftIds.filter((id) => Boolean(AVAILABLE_INPUT_FIELDS.find((f) => f.id === id)))
    applySavedFields(ordered, 'Sandbox columns saved')
  }

  const handleAutoCopyFromUpload = () => {
    const uploadIds = loadSavedFieldIds()
    if (uploadIds.length === 0) {
      showToast('Upload has no saved columns to copy', 'warning')
      return
    }
    applySavedFields(uploadIds, 'Copied columns from Upload')
  }

  const handleRun = async () => {
    if (running) return
    if (savedFields.length === 0) {
      setErrors(['Save column configuration before running Sandbox QC'])
      return
    }

    syncPasteText()
    const raw = pasteInputRef.current?.value ?? pasteTextRef.current
    const { row, errors: parseErrors } = parseSandboxValuesOnly(raw, savedFields)
    if (!row || parseErrors.length > 0) {
      setErrors(parseErrors)
      setQcResult(null)
      setShowResults(false)
      setTerminalLines([])
      return
    }

    clearTimers()
    const gen = ++runGenRef.current

    let result: SandboxQcResult
    const qcBridge = window.electronAPI?.qc
    if (qcBridge?.processRow) {
      const backend = await qcBridge.processRow({
        row,
        rowIndex: 0,
        headless: settings.headlessScraping,
        vendorId: VENDOR_INTEGRATION_ID,
        settings: {
          titleSimilarityPercent: settings.titleSimilarityPercent,
          imageSimilarityPercent: settings.imageSimilarityPercent,
          descriptionSimilarityPercent: settings.descriptionSimilarityPercent,
          specificationSimilarityPercent: settings.specificationSimilarityPercent,
        },
        brandAliases: [...aliasPairs],
      })
      if (!backend.ok) {
        setErrors([backend.error])
        setQcResult(null)
        setShowResults(false)
        setTerminalLines([])
        return
      }
      if (backend.mode === 'capture') {
        if (!backend.result.verdict) {
          setErrors(['Capture returned no QC verdict. Run the row from Upload → Live Output.'])
          setQcResult(null)
          setShowResults(false)
          setTerminalLines([])
          return
        }
        result = {
          identity: backend.result.identity,
          verdict: backend.result.verdict,
          comparisons: (backend.result.comparisons ?? []).map((field) => ({
            ...field,
            outcome: 'MATCH' as const,
          })),
          asinExtract: {
            source: 'amazon',
            asin: backend.result.identity.find((f) => f.key === 'listing_id')?.value ?? '',
            title: '',
            brand: '',
            modelNumber: '',
            packSize: '',
            upc: '',
            imageUrl: '',
            listingUrl: '',
            rawAttributes: {},
          },
          vendorExtract: {
            source: 'vendor_website',
            sku: backend.result.identity.find((f) => f.key === 'sku')?.value ?? '',
            title: '',
            brand: '',
            line: '',
            modelNumber: '',
            packSize: '',
            upc: backend.result.identity.find((f) => f.key === 'upc')?.value ?? '',
            imageUrl: '',
            pageUrl: '',
            rawAttributes: {},
          },
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          estimatedX1000Usd: 0,
          fetched: {
            source: 'amazon',
            asin: backend.result.identity.find((f) => f.key === 'listing_id')?.value ?? '',
            title: '',
            brand: '',
            modelNumber: '',
            packSize: '',
            upc: '',
            imageUrl: '',
            listingUrl: '',
            rawAttributes: {},
          },
        }
      } else {
        result = listingQcPayloadToSandboxQcResult(backend.result)
      }
    } else {
      result = buildSandboxQcResult(row, settings, { brandAliases: aliasPairs })
    }

    const script = buildSandboxTerminalScript(row, result, {
      headlessScraping: settings.headlessScraping,
    })

    setErrors([])
    setQcResult(null)
    setShowResults(false)
    setTerminalLines([])
    setRunning(true)

    appendLog({
      category: 'SYSTEM',
      message: 'Sandbox QC started',
      detail: result.identity.map((f) => f.value).join(' · '),
    })

    for (const step of script) {
      const timerId = window.setTimeout(() => {
        if (gen !== runGenRef.current) return
        setTerminalLines((prev) => [
          ...prev,
          {
            id: `${gen}-${prev.length}`,
            at: Date.now(),
            level: step.level,
            text: step.text,
          },
        ])
      }, step.delayMs)
      timersRef.current.push(timerId)
    }

    const finishAt = script[script.length - 1]?.delayMs ?? 0
    const doneTimer = window.setTimeout(() => {
      if (gen !== runGenRef.current) return
      setQcResult(result)
      setShowResults(true)
      setRunning(false)
      if (result.inputTokens > 0 || result.outputTokens > 0) {
        recordUsage(result.inputTokens, result.outputTokens)
      }

      const sku = result.identity.find((f) => f.key === 'sku')?.value ?? result.identity[0]?.value
      if (result.verdict === 'FAIL') {
        appendLog({ category: 'ERROR', message: `Sandbox FAIL — ${sku}` })
      } else if (result.verdict === 'MANUAL_REVIEW') {
        appendLog({ category: 'WARNING', message: `Sandbox MANUAL REVIEW — ${sku}` })
      } else {
        appendLog({ category: 'QC', message: `Sandbox PASS — ${sku}` })
      }
      showToast(`Sandbox ${result.verdict.replace(/_/g, ' ')}`, result.verdict === 'PASS' ? 'success' : 'warning')
    }, finishAt + 80)
    timersRef.current.push(doneTimer)
  }

  const handleClear = () => {
    clearTimers()
    runGenRef.current += 1
    setRunning(false)
    setTerminalLines([])
    setQcResult(null)
    setShowResults(false)
    setErrors([])
  }

  const placeholder = savedFields.length > 0 ? buildSandboxValuesPlaceholder(savedFields) : ''

  return (
    <PageFrame
      title="Sandbox"
      subtitle="Single-row QC sandbox (comparison mode)."
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {running && <CircularProgress size={16} thickness={5} />}
          <Button
            variant="outlined"
            onClick={handleClear}
            disabled={!running && terminalLines.length === 0 && !showResults}
            sx={{ height: 32, fontSize: '12px', borderRadius: 0.5 }}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            onClick={handleRun}
            disabled={running || savedFields.length === 0}
            sx={{ height: 32, fontSize: '12px', borderRadius: 0.5, boxShadow: 'none' }}
          >
            Run QC
          </Button>
        </Box>
      }
    >
      {/* Column configurator — compact */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)',
          bgcolor: isDark ? '#141416' : '#ffffff',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.25,
            flexWrap: 'wrap',
            mb: 1.5,
          }}
        >
          <Typography sx={{ fontSize: '14px', fontWeight: 650, letterSpacing: '-0.01em' }}>
            Column Configurator
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={handleAutoCopyFromUpload}
              disabled={running}
              sx={{
                height: 32,
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 1.75,
                px: 1.25,
              }}
            >
              Auto Copy from Upload
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveFields}
              disabled={draftIds.length === 0 || !draftDirty || running}
              sx={{
                height: 32,
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 1.75,
                boxShadow: 'none',
                px: 1.5,
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
        <InputFieldChipSelect
          fields={AVAILABLE_INPUT_FIELDS}
          selectedIds={draftIds}
          onToggle={toggleDraft}
          disabled={running}
          compact
        />
      </Paper>

      {errors.length > 0 && (
        <Alert severity="error" sx={{ borderRadius: 0.5, '& .MuiAlert-message': { fontSize: '12px' } }}>
          {errors.map((e, i) => (
            <Box key={`${i}-${e.slice(0, 40)}`}>{e}</Box>
          ))}
        </Alert>
      )}

      {/*
        Stacked workspace (rows): SKU input on top, terminal below.
        Input stays a fixed compact band; terminal scrolls in its own pane — no overlap.
      */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          minWidth: 0,
        }}
      >
        {/* SKU input — full-width row, fixed height so values never get hidden */}
        <Paper
          sx={{
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            flexShrink: 0,
            opacity: savedFields.length === 0 ? 0.65 : 1,
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 0.85,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexShrink: 0,
              bgcolor: isDark ? 'rgba(0,0,0,0.22)' : 'action.hover',
            }}
          >
            <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
              SKU INPUT
            </Typography>
          </Box>

          {savedFields.length > 0 && (
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                overflowX: 'auto',
              }}
            >
              <TabularColumnHeader fields={savedFields} />
            </Box>
          )}

          <Box sx={{ flexShrink: 0 }}>
            <TextField
              key={pasteResetKey}
              multiline
              minRows={1}
              maxRows={1}
              fullWidth
              defaultValue={pasteDefault}
              inputRef={pasteInputRef}
              onInput={syncPasteText}
              placeholder={placeholder}
              disabled={savedFields.length === 0 || running}
              sx={pasteInputSx}
            />
          </Box>
        </Paper>

        {/* Terminal — full-width row under SKU input; scrolls internally */}
        <Paper
          sx={{
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: { xs: 260, md: 300 },
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 0.85,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              bgcolor: isDark ? 'rgba(0,0,0,0.35)' : 'action.hover',
            }}
          >
            <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
              TERMINAL · LIVE QC OUTPUT
            </Typography>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary', fontFamily: fontFamilyMono }}>
              {running ? 'streaming…' : terminalLines.length > 0 ? `${terminalLines.length} lines` : 'idle'}
            </Typography>
          </Box>
          <Box
            ref={terminalRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              bgcolor: isDark ? '#09090b' : '#fafafa',
              userSelect: 'text',
            }}
          >
            {terminalLines.length === 0 ? (
              <Typography
                sx={{ px: 1.5, py: 2, fontSize: '12px', color: 'text.secondary', fontFamily: fontFamilyMono }}
              >
                Press Run QC — live steps stream here below the SKU input row.
              </Typography>
            ) : (
              terminalLines.map((line) => (
                <TerminalLineRow key={line.id} line={line} isDark={isDark} />
              ))
            )}
          </Box>
        </Paper>
      </Box>

      {/* Final verdict strip */}
      {showResults && qcResult && (
        <Paper
          sx={{
            p: 1.5,
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
              FINAL VERDICT
            </Typography>
            <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.25 }}>
              {qcResult.identity.map((f) => `${f.label}: ${f.value}`).join(' · ')}
            </Typography>
          </Box>
          <QcVerdictChip verdict={qcResult.verdict} density="default" />
        </Paper>
      )}

      {/* Results: raw JSON extracts + QC comparisons (images only in comparison Image row) */}
      {showResults && qcResult && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          <RawScrapeComparePair
            amazonData={qcResult.asinExtract}
            vendorData={qcResult.vendorExtract}
            asin={qcResult.asinExtract.asin}
            sku={qcResult.vendorExtract.sku}
            maxHeight={{ xs: 240, lg: 280 }}
            amazonEmptyMessage="No ASIN extract yet — run Sandbox QC"
            vendorEmptyMessage="No vendor extract yet — run Sandbox QC"
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 0.85fr)' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <SandboxQcComparisons comparisons={qcResult.comparisons} isDark={isDark} />

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' },
                gap: 1,
                minWidth: 0,
              }}
            >
              {[
                ['Input Tokens', qcResult.inputTokens.toLocaleString()],
                ['Output Tokens', qcResult.outputTokens.toLocaleString()],
                ['Cost (USD)', formatUsd(qcResult.costUsd)],
                ['Est. ×1000 Cost', formatUsd(qcResult.estimatedX1000Usd)],
              ].map(([label, value]) => (
                <Paper
                  key={label}
                  sx={{ p: 1.25, borderRadius: 0.5, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
                >
                  <Typography
                    sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}
                  >
                    {label.toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, mt: 0.35, fontFamily: fontFamilyMono }}>
                    {value}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </PageFrame>
  )
}
