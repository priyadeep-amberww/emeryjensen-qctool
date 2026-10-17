import { useCallback, useState } from 'react'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAppTheme } from '../../theme'
import { useToast } from '../toast'
import { exportQcBatch } from '../../services/qcExportApi'
import type { ExportVerdictCounts, ExportVerdictFilter } from '../../utils/qcExport'

type ExportScope = 'partial' | 'full'

const FILTER_OPTIONS: { key: ExportVerdictFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pass', label: 'Pass' },
  { key: 'fail', label: 'Fail' },
  { key: 'manual', label: 'Manual' },
  { key: 'exceptions', label: 'Exceptions' },
]

function filteredCount(counts: ExportVerdictCounts, filter: ExportVerdictFilter): number {
  if (filter === 'all') return counts.all
  return counts[filter]
}

type ExportBatchPanelProps = {
  title: string
  statusText: string
  counts: ExportVerdictCounts
  batchTotal: number
  sessionId: string | null
  vendorDisplayName?: string
  exportEnabled: boolean
  exportScope: ExportScope
}

export function ExportBatchPanel({
  title,
  statusText,
  counts,
  batchTotal,
  sessionId,
  vendorDisplayName,
  exportEnabled,
  exportScope,
}: ExportBatchPanelProps) {
  const { mode } = useAppTheme()
  const { showToast } = useToast()
  const [filter, setFilter] = useState<ExportVerdictFilter>('all')
  const [exporting, setExporting] = useState(false)
  const isDark = mode === 'dark'
  const rowsForFilter = filteredCount(counts, filter)

  const runExport = useCallback(async () => {
    if (!exportEnabled) {
      showToast(
        exportScope === 'full'
          ? 'Full export unlocks when the batch finishes'
          : 'No finished QC rows to export yet',
        'warning',
      )
      return
    }
    if (rowsForFilter === 0) {
      showToast('No rows match the current verdict filter', 'warning')
      return
    }
    if (!sessionId) {
      showToast('Batch session missing — restart QC from Upload', 'error')
      return
    }

    setExporting(true)
    try {
      const result = await exportQcBatch({
        scope: exportScope,
        format: 'xlsx',
        filter,
        sessionId,
        batchTotal,
        vendorDisplayName,
      })
      if (!result.ok) {
        const cancelled = result.error.toLowerCase().includes('cancel')
        showToast(result.error, cancelled ? 'info' : 'error')
        return
      }
      const scopeLabel = exportScope === 'partial' ? 'Partial' : 'Full'
      const destination = result.filePath ?? result.fileName
      showToast(
        `${scopeLabel} export · ${result.rowCount} row(s) · Excel · ${destination}`,
        'success',
      )
    } finally {
      setExporting(false)
    }
  }, [
    batchTotal,
    exportEnabled,
    exportScope,
    filter,
    rowsForFilter,
    sessionId,
    showToast,
    vendorDisplayName,
  ])

  const border = isDark ? '#2a2a2a' : 'rgba(15,23,42,0.12)'
  const selectedBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(24,24,27,0.08)'
  const selectedBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(24,24,27,0.18)'

  return (
    <Box
      sx={{
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: { xs: 1.75, sm: 2 },
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: border,
        bgcolor: isDark ? '#141416' : '#ffffff',
      }}
    >
      <Box>
        <Typography
          sx={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'text.secondary',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: '12px',
            color: 'text.secondary',
            mt: 0.5,
            lineHeight: 1.45,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {statusText}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {FILTER_OPTIONS.map((option) => {
          const selected = filter === option.key
          return (
            <Button
              key={option.key}
              variant="outlined"
              color="inherit"
              onClick={() => setFilter(option.key)}
              sx={{
                minHeight: 28,
                px: 1.1,
                py: 0.35,
                fontSize: '11px',
                fontWeight: 600,
                lineHeight: 1.2,
                borderRadius: 0.5,
                border: '1px solid',
                borderColor: selected ? selectedBorder : border,
                color: selected ? 'text.primary' : 'text.secondary',
                bgcolor: selected ? selectedBg : 'transparent',
                boxShadow: 'none',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: selected ? selectedBg : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                  borderColor: selected ? selectedBorder : border,
                },
              }}
            >
              {option.label} ({counts[option.key]})
            </Button>
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 'auto', pt: 0.25 }}>
        {exporting && <CircularProgress size={18} thickness={5} />}
        <Button
          variant="outlined"
          color="inherit"
          disabled={!exportEnabled || exporting}
          onClick={() => void runExport()}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 40,
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 0.5,
            boxShadow: 'none',
            textTransform: 'none',
            borderColor: border,
            color: 'text.primary',
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'transparent',
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.04)',
              borderColor: border,
            },
            '&.Mui-disabled': { opacity: 0.45 },
          }}
        >
          Export Excel (.xlsx)
        </Button>
      </Box>
    </Box>
  )
}
