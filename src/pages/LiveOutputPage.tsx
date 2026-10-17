import { useEffect, useMemo, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import {
  LIVE_OUTPUT_VERDICT_FILTER_KEYS,
  VerdictFilterChipGroup,
} from '../components/export/VerdictFilterChipGroup'
import { Pagination, getPageItemRange, DEFAULT_PAGE_SIZE_OPTIONS } from '../components/pagination'
import { useBatchResults, useBatchRun } from '../context/BatchDemoContext'
import { useErrorEngine } from '../context/ErrorEngineContext'
import { ComparisonDialog } from '../components/compare/ComparisonDialog'
import { QcControlBar, liveOutputControlBtnSx } from '../components/live/QcControlBar'
import { CaptureStatusChip, QcVerdictChip } from '../components/status'
import { hasCaptureResults } from '../utils/captureStats'
import { useAppTheme } from '../theme'
import type { QcIdentityField, QcResult } from '../types/qc'
import { filterLiveOutputResults, matchesLiveOutputSearch } from '../utils/liveOutputFilters'
import {
  fetchVendorSessionStatus,
  vendorSessionStatusLabel,
  type VendorSessionStatus,
} from '../services/vendorSession/vendorSessionStatusApi'
import { countExportVerdicts, type ExportVerdictFilter } from '../utils/qcExport'

const PAGE_SIZE_OPTIONS = [...DEFAULT_PAGE_SIZE_OPTIONS]
const DEFAULT_PAGE_SIZE = 25

/** Collect identity column definitions from completed results (order preserved from first row). */
function collectIdentityColumns(results: readonly QcResult[]): QcIdentityField[] {
  const seen = new Map<string, QcIdentityField>()
  for (const result of results) {
    for (const field of result.identity) {
      if (!seen.has(field.key)) {
        seen.set(field.key, { key: field.key, label: field.label, value: '' })
      }
    }
  }
  return [...seen.values()]
}

function identityValue(result: QcResult, key: string): string {
  return result.identity.find((f) => f.key === key)?.value ?? '—'
}

export function LiveOutputPage() {
  const {
    completedCount,
    exportVerdictCounts,
    total,
    status,
    pause,
    resume,
    stop,
    reset,
  } = useBatchRun()
  const { getCompletedResults, resultsRevision } = useBatchResults()
  const { phase, statusMessage } = useErrorEngine()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const [viewResult, setViewResult] = useState<QcResult | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useState('')
  const [verdictFilter, setVerdictFilter] = useState<ExportVerdictFilter>('all')
  const [vendorSession, setVendorSession] = useState<VendorSessionStatus>({
    state: 'idle',
    armed: false,
  })

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const next = await fetchVendorSessionStatus()
      if (!cancelled) setVendorSession(next)
    }
    void poll()
    const id = window.setInterval(() => void poll(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const completed = getCompletedResults()

  const identityColumns = useMemo(
    () => collectIdentityColumns(completed),
    [resultsRevision, completed],
  )

  const captureMode = useMemo(() => hasCaptureResults(completed), [completed, resultsRevision])

  const counts = useMemo(
    () => ({
      pass: exportVerdictCounts.pass,
      fail: exportVerdictCounts.fail,
      manual: exportVerdictCounts.manual,
    }),
    [exportVerdictCounts],
  )

  const filteredResults = useMemo(
    () => filterLiveOutputResults(completed, searchQuery, verdictFilter),
    [completed, searchQuery, verdictFilter, resultsRevision],
  )

  const searchMatchedResults = useMemo(() => {
    if (!searchQuery.trim()) return [...completed]
    return completed.filter((r) => matchesLiveOutputSearch(r, searchQuery))
  }, [completed, searchQuery, resultsRevision])

  const filterChipCounts = useMemo(
    () => countExportVerdicts(searchMatchedResults),
    [searchMatchedResults],
  )

  const filteredCount = filteredResults.length
  const hasActiveFilters = searchQuery.trim().length > 0 || verdictFilter !== 'all'

  useEffect(() => {
    setPage(1)
  }, [searchQuery, verdictFilter])

  const { start: rangeStart, end: rangeEnd } = getPageItemRange(page, pageSize, filteredCount)
  const visibleRows = useMemo(() => {
    if (filteredCount === 0) return []
    const newestFirst = [...filteredResults].reverse()
    return newestFirst.slice(rangeStart, rangeEnd)
  }, [filteredResults, filteredCount, rangeStart, rangeEnd, resultsRevision])

  const colSpan = 1 + Math.max(identityColumns.length, 1) + 1

  return (
    <PageFrame
      title="Live output"
      subtitle="QC results stream in as each product finishes. Comparison fields adapt to the vendor tool."
      actions={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => void reset()} sx={liveOutputControlBtnSx}>
            Reset
          </Button>
          <Typography
            component="span"
            sx={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: vendorSession.armed ? 'success.main' : 'warning.main',
              px: 1,
            }}
          >
            Portal: {vendorSessionStatusLabel(vendorSession)}
          </Typography>
          <QcControlBar
            status={status}
            allowStart={false}
            onStart={() => {}}
            onPause={() => void pause()}
            onResume={() => void resume()}
            onStop={() => void stop()}
          />
        </Box>
      }
    >
      {statusMessage && phase !== 'idle' && (
        <Alert
          severity={
            phase === 'recovery_failed' ? 'error' : phase === 'recovered' ? 'success' : 'warning'
          }
          sx={{ borderRadius: 0.5, '& .MuiAlert-message': { fontSize: '12px', fontWeight: 600 } }}
        >
          {statusMessage}
        </Alert>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1.5 }}>
        {[
          ['Passed', counts.pass, 'success.main'],
          ['Failed', counts.fail, 'error.main'],
          ['Manual review', counts.manual, 'warning.main'],
          ['Progress', `${completedCount} / ${total}`, 'text.primary'],
        ].map(([label, value, color]) => (
          <Paper key={String(label)} sx={{ p: 1.5, borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
              {String(label).toUpperCase()}
            </Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 700, color: color as string }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          width: '100%',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          rowGap: 0.75,
        }}
      >
        <TextField
          size="small"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search SKU, UPC, model, brand, ASIN…"
          sx={{
            flex: '1 1 0',
            minWidth: { xs: '100%', sm: 160 },
            width: { xs: '100%', sm: 'auto' },
            '& .MuiInputBase-input': { fontSize: '12px' },
            '& .MuiOutlinedInput-root': { borderRadius: 0.5 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                    edge="end"
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: '0 0 auto',
            flexWrap: 'nowrap',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}
        >
          <VerdictFilterChipGroup
            value={verdictFilter}
            onChange={setVerdictFilter}
            counts={filterChipCounts}
            isDark={isDark}
            compact
            filterKeys={LIVE_OUTPUT_VERDICT_FILTER_KEYS}
            disabled={completedCount === 0}
          />
          {hasActiveFilters && (
            <Typography
              sx={{ fontSize: '11px', color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {filteredCount} / {completedCount}
            </Typography>
          )}
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 0.5, border: '1px solid', borderColor: 'divider', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700 }}>
                  {captureMode ? 'Capture' : 'Verdict'}
                </TableCell>
                {identityColumns.length > 0 ? (
                  identityColumns.map((col) => (
                    <TableCell key={col.key} sx={{ fontSize: '11px', fontWeight: 700 }}>
                      {col.label}
                    </TableCell>
                  ))
                ) : (
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700 }}>Product</TableCell>
                )}
                <TableCell sx={{ fontSize: '11px', fontWeight: 700 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {completedCount === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} sx={{ fontSize: '12px', color: 'text.secondary', py: 3 }}>
                    {status === 'running'
                      ? 'QC in progress — waiting for the first result…'
                      : 'Press START to begin QC. Results appear here one by one.'}
                  </TableCell>
                </TableRow>
              )}
              {completedCount > 0 && filteredCount === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} sx={{ fontSize: '12px', color: 'text.secondary', py: 3 }}>
                    No results match your search or verdict filter. Clear filters to see all rows.
                  </TableCell>
                </TableRow>
              )}
              {visibleRows.map((result) => (
                <TableRow key={result.id} className="animate-fade-in">
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {result.verdict ? <QcVerdictChip verdict={result.verdict} /> : null}
                      {result.captureStatus ? <CaptureStatusChip status={result.captureStatus} /> : null}
                    </Box>
                  </TableCell>
                  {identityColumns.length > 0 ? (
                    identityColumns.map((col) => (
                      <TableCell
                        key={col.key}
                        sx={{
                          fontSize: '12px',
                          fontFamily: col.key === 'reference' ? 'inherit' : 'monospace',
                        }}
                      >
                        {identityValue(result, col.key)}
                      </TableCell>
                    ))
                  ) : (
                    <TableCell sx={{ fontSize: '12px' }}>{result.id}</TableCell>
                  )}
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      onClick={() => setViewResult(result)}
                      sx={liveOutputControlBtnSx}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Pagination
          totalItems={filteredCount}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(next) => {
            setPageSize(next)
            setPage(1)
          }}
          boundaryCount={3}
        />
      </Paper>

      <ComparisonDialog open={Boolean(viewResult)} result={viewResult} onClose={() => setViewResult(null)} />
    </PageFrame>
  )
}
