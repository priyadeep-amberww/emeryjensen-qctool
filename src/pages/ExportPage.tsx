import { useEffect, useMemo, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import { ExportVendorIdentity, FullExport, PartialExport } from '../components/export'
import { useBatchRun } from '../context/BatchDemoContext'
import { useAppTheme } from '../theme'

function formatSpeedPerSku(startedAt: number | null, completedCount: number, now: number): string {
  if (!startedAt || completedCount <= 0) return '—'
  const elapsedMs = Math.max(now - startedAt, 1)
  const secondsPerSku = elapsedMs / completedCount / 1000
  if (secondsPerSku < 0.01) return '<0.01s / SKU'
  return `${secondsPerSku.toFixed(2)}s / SKU`
}

export function ExportPage() {
  const { completedCount, exportVerdictCounts, total, status, startedAt } = useBatchRun()
  const { mode } = useAppTheme()
  const [now, setNow] = useState(() => Date.now())
  const isDark = mode === 'dark'
  const border = isDark ? '#2a2a2a' : 'divider'

  useEffect(() => {
    if (status !== 'running') {
      setNow(Date.now())
      return
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status])

  const counts = useMemo(
    () => ({
      pass: exportVerdictCounts.pass,
      fail: exportVerdictCounts.fail,
      manual: exportVerdictCounts.manual,
    }),
    [exportVerdictCounts],
  )

  const remaining = Math.max(total - completedCount, 0)
  const speedLabel = formatSpeedPerSku(startedAt, completedCount, now)

  const statusBoxes = [
    {
      key: 'pass',
      label: 'PASS',
      count: counts.pass,
      border: 'success.main',
      bg: isDark ? '#141416' : 'rgba(34, 197, 94, 0.12)',
      value: 'success.main',
    },
    {
      key: 'manual',
      label: 'MANUAL REVIEW',
      count: counts.manual,
      border: 'warning.main',
      bg: isDark ? '#141416' : 'rgba(245, 158, 11, 0.14)',
      value: 'warning.main',
    },
    {
      key: 'fail',
      label: 'FAIL',
      count: counts.fail,
      border: 'error.main',
      bg: isDark ? '#141416' : 'rgba(239, 68, 68, 0.12)',
      value: 'error.main',
    },
  ]

  return (
    <PageFrame title="Export" subtitle="Partial · full batch · verdict filters">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <PartialExport />
        <ExportVendorIdentity />
        <FullExport />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5 }}>
        {statusBoxes.map((box) => (
          <Paper
            key={box.key}
            sx={{
              p: 1.75,
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: box.border,
              bgcolor: box.bg,
            }}
          >
            <Typography
              sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: box.value }}
            >
              {box.label}
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 700, color: box.value, mt: 0.25 }}>
              {box.count}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5 }}>
        <Paper sx={{ p: 1.75, borderRadius: 0.5, border: '1px solid', borderColor: border, bgcolor: isDark ? '#141416' : '#ffffff' }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            TOTAL SKU PROGRESS
          </Typography>
          <Typography sx={{ fontSize: '22px', fontWeight: 700, mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
            {completedCount} / {total}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.5 }}>
            {remaining} remaining
          </Typography>
        </Paper>

        <Paper sx={{ p: 1.75, borderRadius: 0.5, border: '1px solid', borderColor: border, bgcolor: isDark ? '#141416' : '#ffffff' }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            QC SPEED PER SKU
          </Typography>
          <Typography sx={{ fontSize: '22px', fontWeight: 700, mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
            {speedLabel}
          </Typography>
          <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.5 }}>
            {status === 'running'
              ? 'Updating live'
              : status === 'done'
                ? 'Batch complete'
                : status === 'paused'
                  ? 'Paused'
                  : 'Waiting for QC'}
          </Typography>
        </Paper>
      </Box>

      <Paper
        sx={{
          p: 2,
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: border,
          bgcolor: isDark ? '#141416' : '#ffffff',
        }}
      >
        <Typography sx={{ fontSize: '13px', fontWeight: 700 }}>Batch summary</Typography>
        <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.75, lineHeight: 1.5 }}>
          {completedCount === 0
            ? status === 'running'
              ? 'QC in progress — counters update as each SKU finishes. Per-SKU preview is disabled here to keep large batches responsive.'
              : 'No QC results yet. Start a batch from Live Output.'
            : `${completedCount} finished QC result(s) stored for this session. Use Excel export above for the EMRY QC workbook.`}
        </Typography>
      </Paper>
    </PageFrame>
  )
}
