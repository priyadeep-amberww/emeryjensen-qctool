import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PreviewOutlinedIcon from '@mui/icons-material/PreviewOutlined'
import { PageFrame } from '../components/layout/PageFrame'
import { useToast } from '../components/toast'
import { useBatchResults, useBatchRun } from '../context/BatchDemoContext'
import { useAppTheme } from '../theme'
import { generateCustomExcel } from '../services/customExportApi'
import type { CustomExportConfig, CustomExportSummary } from '../types/customExport'
import {
  draftToColumnKeys,
  mergeDraftWithCatalog,
  readExportDraft,
  readLockedExportSnapshot,
  writeExportDraft,
  type CustomExportDraft,
} from '../utils/customExportDraft'
import {
  deleteCustomExportTemplate,
  listCustomExportTemplates,
  saveCustomExportTemplate,
} from '../utils/customExportStorage'
import { filterQcResultsForExport } from '../utils/qcExport'
import {
  buildExportRowValues,
  buildMandatoryExportColumns,
  discoverExportCatalog,
  type ExportColumnDef,
} from '../utils/qcExportColumns'
import { VerdictFilterChipGroup } from '../components/export/VerdictFilterChipGroup'

const PREVIEW_LIMIT = 10

const LOCK_MESSAGE =
  'Export settings locked — QC batch is running. Settings unlock when the batch completes or stops.'

function formatTimeTaken(startedAt: number | null, status: string, now: number): string {
  if (!startedAt) return '—'
  if (status === 'running' || status === 'paused') {
    const sec = Math.max((now - startedAt) / 1000, 0)
    return `${sec.toFixed(1)}s (in progress)`
  }
  const sec = Math.max((now - startedAt) / 1000, 0)
  if (sec < 60) return `${sec.toFixed(1)}s`
  const min = Math.floor(sec / 60)
  const rem = Math.round(sec % 60)
  return `${min}m ${rem}s`
}

function buildSummary(
  rows: ReturnType<typeof filterQcResultsForExport>,
  startedAt: number | null,
  status: string,
  now: number,
): CustomExportSummary {
  let pass = 0
  let fail = 0
  let manual = 0
  for (const r of rows) {
    if (r.verdict === 'PASS') pass++
    else if (r.verdict === 'FAIL') fail++
    else manual++
  }
  const total = rows.length
  const passPct = total > 0 ? `${((pass / total) * 100).toFixed(1)}%` : '0%'
  const failPct = total > 0 ? `${((fail / total) * 100).toFixed(1)}%` : '0%'
  return {
    total,
    pass,
    fail,
    manual,
    passPct,
    failPct,
    timeTakenLabel: formatTimeTaken(startedAt, status, now),
  }
}

function isBatchExportLocked(status: string): boolean {
  return status === 'running' || status === 'paused'
}

function Panel({
  children,
  isDark,
  sx,
}: {
  children: ReactNode
  isDark: boolean
  sx?: object
}) {
  return (
    <Box
      sx={{
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: isDark ? '#2a2a2a' : 'rgba(15,23,42,0.12)',
        bgcolor: isDark ? '#141416' : '#ffffff',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'text.secondary',
        mb: 1.25,
      }}
    >
      {children}
    </Typography>
  )
}

/** Thin charcoal pill scrollbar matching the export-custom reference UI. */
function thinScrollbarSx(isDark: boolean) {
  return {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: isDark ? 'rgba(82,82,91,0.85) transparent' : 'rgba(148,163,184,0.7) transparent',
    '&::-webkit-scrollbar': {
      width: 5,
      height: 5,
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
      marginBlock: 6,
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: isDark ? 'rgba(82,82,91,0.9)' : 'rgba(148,163,184,0.75)',
      borderRadius: 999,
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: isDark ? 'rgba(113,113,122,0.95)' : 'rgba(100,116,139,0.85)',
    },
    '&::-webkit-scrollbar-corner': {
      background: 'transparent',
    },
  }
}

export function ExportCustomizationPage() {
  const { completedCount, exportVerdictCounts, status, startedAt } = useBatchRun()
  const { getCompletedResults, resultsRevision } = useBatchResults()
  const completed = useMemo(() => [...getCompletedResults()], [getCompletedResults, resultsRevision])
  const { showToast } = useToast()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [now, setNow] = useState(() => Date.now())
  const [draft, setDraft] = useState<CustomExportDraft>(() => readExportDraft())
  const [templateName, setTemplateName] = useState('')
  const [templates, setTemplates] = useState(() => listCustomExportTemplates())
  const [exporting, setExporting] = useState(false)

  const isLocked = isBatchExportLocked(status)

  const { mandatory, optional } = useMemo(
    () => discoverExportCatalog(completed),
    [resultsRevision, completed],
  )
  const optionalByKey = useMemo(() => new Map(optional.map((c) => [c.key, c])), [optional])
  const mandatoryColumns = useMemo(() => buildMandatoryExportColumns(), [])

  useEffect(() => {
    if (isLocked) {
      const snapshot = readLockedExportSnapshot()
      if (snapshot) setDraft(mergeDraftWithCatalog(snapshot, completed))
      return
    }
    setDraft((prev) => mergeDraftWithCatalog(prev, completed))
  }, [resultsRevision, completed, isLocked])

  useEffect(() => {
    if (isLocked) return
    writeExportDraft(draft)
  }, [draft, isLocked])

  useEffect(() => {
    if (status !== 'running' && status !== 'paused') {
      setNow(Date.now())
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [status])

  const effectiveDraft = useMemo(() => {
    if (isLocked) {
      const snapshot = readLockedExportSnapshot()
      if (snapshot) return mergeDraftWithCatalog(snapshot, completed)
    }
    return draft
  }, [resultsRevision, completed, draft, isLocked])

  const activeColumnKeys = useMemo(
    () => draftToColumnKeys(effectiveDraft, completed),
    [effectiveDraft, resultsRevision, completed],
  )

  const previewHeaders = useMemo(() => {
    const catalog = new Map([...mandatory, ...optional].map((c) => [c.key, c]))
    return activeColumnKeys.map((key) => catalog.get(key)?.label ?? key)
  }, [activeColumnKeys, mandatory, optional])

  const verdictCounts = exportVerdictCounts

  const filteredRows = useMemo(
    () => filterQcResultsForExport(completed, effectiveDraft.verdictFilter),
    [resultsRevision, completed, effectiveDraft.verdictFilter],
  )

  const previewRows = useMemo(() => filteredRows.slice(0, PREVIEW_LIMIT), [filteredRows])

  const summary = useMemo(
    () => buildSummary(filteredRows, startedAt, status, now),
    [filteredRows, startedAt, status, now],
  )

  const optionalEnabledCount = useMemo(
    () => effectiveDraft.optionalOrder.filter((k) => effectiveDraft.optionalEnabled[k]).length,
    [effectiveDraft.optionalEnabled, effectiveDraft.optionalOrder],
  )

  const updateDraft = useCallback(
    (patch: Partial<CustomExportDraft>) => {
      if (isLocked) return
      setDraft((prev) => ({ ...prev, ...patch }))
    },
    [isLocked],
  )

  const moveOptionalColumn = useCallback(
    (index: number, direction: -1 | 1) => {
      if (isLocked) return
      setDraft((prev) => {
        const next = [...prev.optionalOrder]
        const target = index + direction
        if (target < 0 || target >= next.length) return prev
        ;[next[index], next[target]] = [next[target], next[index]]
        return { ...prev, optionalOrder: next }
      })
    },
    [isLocked],
  )

  const loadTemplate = useCallback(
    (config: CustomExportConfig) => {
      if (isLocked) {
        showToast('Cannot load templates while export settings are locked', 'warning')
        return
      }
      setDraft(mergeDraftWithCatalog(config, completed))
      showToast('Template loaded', 'success')
    },
    [completed, isLocked, showToast],
  )

  const handleSaveTemplate = useCallback(() => {
    if (isLocked) return
    try {
      const saved = saveCustomExportTemplate(templateName, draft)
      setTemplates(listCustomExportTemplates())
      setTemplateName(saved.name)
      showToast(`Saved template "${saved.name}"`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save template'
      showToast(message, 'error')
    }
  }, [draft, isLocked, showToast, templateName])

  const handleExport = useCallback(async () => {
    const exportDraft = isLocked
      ? mergeDraftWithCatalog(readLockedExportSnapshot() ?? effectiveDraft, completed)
      : draft
    const columnKeys = draftToColumnKeys(exportDraft, completed)

    if (completedCount === 0) {
      showToast('No QC results to export yet', 'warning')
      return
    }
    if (filteredRows.length === 0) {
      showToast('No rows match the current verdict filter', 'warning')
      return
    }

    const exportSummary = buildSummary(
      filterQcResultsForExport(completed, exportDraft.verdictFilter),
      startedAt,
      status,
      now,
    )

    setExporting(true)
    try {
      const result = await generateCustomExcel({
        results: [...getCompletedResults()],
        filter: exportDraft.verdictFilter,
        columnKeys,
        includeSummarySheet: exportDraft.includeSummarySheet,
        summary: exportSummary,
      })
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      showToast(`Exported ${result.rowCount} row(s) · ${result.fileName}`, 'success')
    } finally {
      setExporting(false)
    }
  }, [
    completedCount,
    getCompletedResults,
    draft,
    effectiveDraft,
    filteredRows.length,
    isLocked,
    now,
    showToast,
    startedAt,
    status,
  ])

  const controlsDisabled = isLocked

  const tileBorder = isDark ? '#2a2a2a' : 'rgba(15,23,42,0.12)'

  const columnRowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    px: 1.25,
    py: 0.85,
    borderRadius: 0.5,
    border: '1px solid',
    borderColor: tileBorder,
    bgcolor: isDark ? '#121214' : 'rgba(255,255,255,0.85)',
    '&:hover': {
      bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
    },
  } as const

  const renderOptionalRow = (key: string, index: number) => {
    const col = optionalByKey.get(key)
    if (!col) return null
    const checked = Boolean(effectiveDraft.optionalEnabled[key])
    return (
      <Box key={key} sx={columnRowSx}>
        <Checkbox
          size="small"
          disabled={controlsDisabled}
          checked={checked}
          onChange={(_, nextChecked) =>
            setDraft((prev) => ({
              ...prev,
              optionalEnabled: { ...prev.optionalEnabled, [key]: nextChecked },
            }))
          }
          sx={{
            p: 0.35,
            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)',
            '&.Mui-checked': { color: 'primary.main' },
          }}
        />
        <Typography
          sx={{
            fontSize: '12.5px',
            flex: 1,
            minWidth: 0,
            fontWeight: checked ? 500 : 400,
            color: checked ? 'text.primary' : 'text.secondary',
            lineHeight: 1.35,
          }}
          title={col.label}
        >
          {col.label}
        </Typography>
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
          <IconButton
            size="small"
            aria-label="Move up"
            disabled={controlsDisabled || index === 0}
            onClick={() => moveOptionalColumn(index, -1)}
            sx={{ width: 28, height: 28 }}
          >
            <ArrowUpwardIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Move down"
            disabled={controlsDisabled || index === effectiveDraft.optionalOrder.length - 1}
            onClick={() => moveOptionalColumn(index, 1)}
            sx={{ width: 28, height: 28 }}
          >
            <ArrowDownwardIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      </Box>
    )
  }

  const renderMandatoryRow = (col: ExportColumnDef) => (
    <Box key={col.key} sx={{ ...columnRowSx, '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.7)' } }}>
      <Checkbox
        size="small"
        checked
        disabled
        sx={{
          p: 0.35,
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)',
          '&.Mui-checked': { color: isDark ? 'rgba(161,161,170,0.9)' : 'rgba(100,116,139,0.9)' },
        }}
      />
      <Typography
        sx={{ fontSize: '12.5px', flex: 1, minWidth: 0, fontWeight: 500, lineHeight: 1.35 }}
        title={col.label}
      >
        {col.label}
      </Typography>
      <Chip
        label="REQUIRED"
        size="small"
        sx={{
          height: 22,
          fontSize: '9.5px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          bgcolor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.1)',
          color: isDark ? '#93c5fd' : '#1d4ed8',
          border: '1px solid',
          borderColor: isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.22)',
        }}
      />
    </Box>
  )

  const emptyPreview = previewRows.length === 0

  return (
    <PageFrame
      title="Export Customization"
      subtitle="Configure columns and filters before QC · settings lock while a batch runs"
      actions={
        <Button
          variant="contained"
          color="primary"
          disabled={exporting || completedCount === 0}
          startIcon={
            exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlinedIcon />
          }
          onClick={() => void handleExport()}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 2.25,
            py: 1,
            borderRadius: 2,
            boxShadow: 'none',
          }}
        >
          Export to Excel (.xlsx)
        </Button>
      }
    >
      {isLocked && (
        <Alert
          severity="info"
          icon={<LockOutlinedIcon fontSize="small" />}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: isDark ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.22)',
            bgcolor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
            '& .MuiAlert-message': { fontSize: '13px', lineHeight: 1.5 },
            flexShrink: 0,
          }}
        >
          {LOCK_MESSAGE}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 420px) minmax(0, 1fr)' },
          gap: 2.25,
          alignItems: 'stretch',
          flex: 1,
          minHeight: { xs: 560, md: 640 },
          height: { lg: 'calc(100vh - 168px)' },
          maxHeight: { lg: 'calc(100vh - 168px)' },
        }}
      >
        {/* Settings panel — fixed workspace height + internal scroll */}
        <Panel
          isDark={isDark}
          sx={{
            minHeight: { xs: 520, md: 600 },
            height: { lg: '100%' },
            maxHeight: { lg: '100%' },
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: controlsDisabled ? 0.72 : 1,
            transition: 'opacity 160ms ease',
          }}
        >
          <Stack
            spacing={2}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 2,
              pr: 1.25,
              ...thinScrollbarSx(isDark),
            }}
          >
          <Box
            sx={{
              p: 2,
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: tileBorder,
              bgcolor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.02)',
            }}
          >
            <SectionLabel>Verdict filter</SectionLabel>
            <VerdictFilterChipGroup
              value={effectiveDraft.verdictFilter}
              onChange={(verdictFilter) => updateDraft({ verdictFilter })}
              counts={verdictCounts}
              disabled={controlsDisabled}
              isDark={isDark}
            />
            <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 1.35 }}>
              {filteredRows.length} row{filteredRows.length === 1 ? '' : 's'} will be exported
            </Typography>
          </Box>

          <Box
            sx={{
              px: 2,
              py: 1.75,
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: tileBorder,
              bgcolor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.02)',
            }}
          >
            <SectionLabel>Workbook options</SectionLabel>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                flexWrap: 'wrap',
              }}
            >
              <FormControlLabel
                sx={{
                  m: 0,
                  gap: 1.25,
                  '& .MuiSwitch-root': { mr: 0.25 },
                }}
                control={
                  <Switch
                    checked={effectiveDraft.includeSummarySheet}
                    onChange={(_, checked) => updateDraft({ includeSummarySheet: checked })}
                    disabled={controlsDisabled}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>Include Summary sheet</Typography>
                    <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
                      Totals, pass/fail %, time taken
                    </Typography>
                  </Box>
                }
              />
              {effectiveDraft.includeSummarySheet && (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 1,
                    width: '100%',
                    mt: 0.5,
                  }}
                >
                  {[
                    { label: 'Total SKUs', value: String(summary.total) },
                    { label: 'Pass', value: summary.passPct },
                    { label: 'Fail', value: summary.failPct },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      sx={{
                        px: 1.25,
                        py: 1,
                        borderRadius: 0.5,
                        border: '1px solid',
                        borderColor: tileBorder,
                        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.65)',
                      }}
                    >
                      <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
                        {stat.label.toUpperCase()}
                      </Typography>
                      <Typography sx={{ fontSize: '16px', fontWeight: 700, mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
                        {stat.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: tileBorder,
              bgcolor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.02)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 220,
              maxHeight: 280,
            }}
          >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.15, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Typography
                sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}
              >
                MANDATORY COLUMNS
              </Typography>
              <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.35 }}>
                {mandatoryColumns.length} fields always included in every export
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                p: 1.25,
                pr: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.85,
                ...thinScrollbarSx(isDark),
              }}
            >
              {mandatoryColumns.map(renderMandatoryRow)}
            </Box>
          </Box>

          <Box
            sx={{
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: tileBorder,
              bgcolor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.02)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 220,
              maxHeight: 300,
            }}
          >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.15, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Typography
                sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}
              >
                OPTIONAL COLUMNS
              </Typography>
              <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.35 }}>
                {optionalEnabledCount} of {effectiveDraft.optionalOrder.length} selected · reorder with arrows
              </Typography>
            </Box>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                p: 1.25,
                pr: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.85,
                ...thinScrollbarSx(isDark),
              }}
            >
              {effectiveDraft.optionalOrder.map((key, index) => renderOptionalRow(key, index))}
            </Box>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: tileBorder,
              bgcolor: isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <BookmarkBorderOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontSize: '13px', fontWeight: 650 }}>Templates</Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mb: templates.length ? 1.5 : 0 }}>
              <TextField
                size="small"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                disabled={controlsDisabled}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                    fontSize: '13px',
                    bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.02)',
                  },
                }}
              />
              <Button
                variant="outlined"
                color="inherit"
                disabled={controlsDisabled}
                onClick={handleSaveTemplate}
                sx={{ textTransform: 'none', flexShrink: 0, borderRadius: 1.5, px: 1.75 }}
              >
                Save
              </Button>
            </Stack>
            {templates.length === 0 ? (
              <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 1.25 }}>
                Save this layout to reuse it later.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {templates.map((tpl) => (
                  <Box
                    key={tpl.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: 1.5,
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Button
                      size="small"
                      disabled={controlsDisabled}
                      onClick={() => loadTemplate(tpl.config)}
                      sx={{
                        textTransform: 'none',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        color: 'text.primary',
                        px: 0.5,
                      }}
                    >
                      {tpl.name}
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      disabled={controlsDisabled}
                      onClick={() => {
                        deleteCustomExportTemplate(tpl.id)
                        setTemplates(listCustomExportTemplates())
                      }}
                      sx={{ textTransform: 'none', fontSize: '11px', color: 'text.secondary', minWidth: 0 }}
                    >
                      Remove
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
          </Stack>
        </Panel>

        {/* Preview — same workspace height */}
        <Panel
          isDark={isDark}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 520, md: 600 },
            height: { lg: '100%' },
            maxHeight: { lg: '100%' },
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2.25,
              py: 1.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 650, letterSpacing: '-0.01em' }}>
                Live preview
              </Typography>
              <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.25 }}>
                {emptyPreview
                  ? 'No QC rows yet'
                  : `Showing ${previewRows.length} of ${filteredRows.length} · ${activeColumnKeys.length} columns`}
                {isLocked ? ' · locked' : ''}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Chip size="small" label={`${mandatoryColumns.length} required`} />
              <Chip size="small" label={`${optionalEnabledCount} optional`} variant="outlined" />
            </Stack>
          </Box>

          {emptyPreview ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
                py: 6,
                textAlign: 'center',
                bgcolor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.02)',
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  bgcolor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                  color: 'primary.main',
                }}
              >
                <PreviewOutlinedIcon sx={{ fontSize: 28 }} />
              </Box>
              <Typography sx={{ fontSize: '15px', fontWeight: 650, mb: 0.75 }}>
                {completedCount === 0 ? 'Preview waiting for QC results' : 'No rows match this filter'}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: 'text.secondary', maxWidth: 380, lineHeight: 1.55 }}>
                {completedCount === 0
                  ? 'Pick filters and columns on the left, then run QC from Upload. Rows appear here as they finish.'
                  : 'Change the verdict filter to see matching results in this preview.'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', ...thinScrollbarSx(isDark) }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {previewHeaders.map((label) => (
                      <TableCell
                        key={label}
                        sx={{
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          color: 'text.secondary',
                          bgcolor: isDark ? '#1a1a1d' : '#f1f5f9',
                          borderColor: 'divider',
                          py: 1.15,
                        }}
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, rowIndex) => {
                    const values = buildExportRowValues(row, activeColumnKeys)
                    return (
                      <TableRow
                        key={row.id}
                        sx={{
                          bgcolor:
                            rowIndex % 2 === 0
                              ? 'transparent'
                              : isDark
                                ? 'rgba(255,255,255,0.02)'
                                : 'rgba(15,23,42,0.02)',
                        }}
                      >
                        {values.map((value, i) => (
                          <TableCell
                            key={`${row.id}-${activeColumnKeys[i]}`}
                            sx={{
                              fontSize: '12px',
                              maxWidth: 220,
                              whiteSpace: 'nowrap',
                              borderColor: 'divider',
                              py: 1,
                            }}
                            title={value}
                          >
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          )}

          <Box
            sx={{
              px: 2.25,
              py: 1.35,
              borderTop: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontSize: '11px', color: 'text.secondary', lineHeight: 1.45 }}>
              Excel output: bold headers · frozen top row · auto-fit widths · Pass/Fail colors on VERDICT
            </Typography>
          </Box>
        </Panel>
      </Box>
    </PageFrame>
  )
}
