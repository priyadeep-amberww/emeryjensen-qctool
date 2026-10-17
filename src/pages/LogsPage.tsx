import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { PageFrame } from '../components/layout/PageFrame'
import { Pagination, getPageItemRange, DEFAULT_PAGE_SIZE_OPTIONS } from '../components/pagination'
import { useToast } from '../components/toast'
import { useLogs } from '../context/LogsContext'
import { useBatchDemo } from '../context/BatchDemoContext'
import { useAppTheme } from '../theme'
import { getLogCategoryTone } from '../utils/logCategoryStyles'
import { fontFamilyMono } from '../theme/typography'
import type { QcLogEntry } from '../types/log'

const PAGE_SIZE_OPTIONS = [...DEFAULT_PAGE_SIZE_OPTIONS]
const DEFAULT_PAGE_SIZE = 50
const COPY_SUCCESS_RESET_MS = 2000

function formatTimestamp(at: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    }).format(new Date(at))
  } catch {
    const d = new Date(at)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`
  }
}

const LOGS_HEADER_COLUMNS = ['Timestamp', 'Category', 'Message'] as const

function formatLogEntryForCopy(entry: QcLogEntry): string {
  const ts = formatTimestamp(entry.at)
  const meta = [entry.batchLabel, entry.detail].filter(Boolean).join(' · ')
  if (meta) {
    return `${ts}\t${entry.category}\t${entry.message}\t${meta}`
  }
  return `${ts}\t${entry.category}\t${entry.message}`
}

function buildFilteredLogsClipboardText(entries: QcLogEntry[]): string {
  return entries.map(formatLogEntryForCopy).join('\n')
}

const CategoryChip = memo(function CategoryChip({
  category,
  selected,
  onToggle,
  count,
}: {
  category: string
  selected: boolean
  onToggle: (category: string) => void
  count?: number
}) {
  const { mode } = useAppTheme()
  const tone = getLogCategoryTone(category, mode === 'dark')
  const glow =
    mode === 'dark'
      ? `0 0 0 1px ${tone.activeBorder}, 0 0 12px ${tone.activeBg}55`
      : `0 0 0 1px ${tone.activeBorder}33, 0 1px 2px rgba(24,24,27,0.12)`

  /** Solid active look — used for selected AND hover/focus/active (no black flash). */
  const activeSx = {
    borderColor: `${tone.activeBorder} !important`,
    color: `${tone.activeText} !important`,
    bgcolor: `${tone.activeBg} !important`,
    backgroundColor: `${tone.activeBg} !important`,
    boxShadow: glow,
  } as const

  return (
    <Chip
      size="small"
      label={count != null ? `${category} (${count})` : category}
      onClick={() => onToggle(category)}
      variant="outlined"
      sx={{
        height: 24,
        fontSize: '10px',
        fontWeight: 700,
        borderRadius: 0.5,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        border: '1px solid',
        borderColor: selected ? tone.activeBorder : tone.idleBorder,
        color: selected ? tone.activeText : tone.idleText,
        bgcolor: selected ? tone.activeBg : tone.idleBg,
        backgroundImage: 'none',
        boxShadow: selected ? glow : 'none',
        transition: 'background-color 80ms ease, border-color 80ms ease, color 80ms ease, box-shadow 80ms ease',
        '& .MuiChip-label': { px: 1 },
        // Beat MUI clickable hover overlay that turns the chip black.
        '&&:hover, &&:focus, &&:active, &&.Mui-focusVisible, &&.MuiChip-clickable:hover, &&.MuiChip-clickable:focus, &&.MuiChip-clickable:active':
          activeSx,
        ...(selected ? { '&&': activeSx } : null),
      }}
    />
  )
})

const LogRow = memo(function LogRow({ entry }: { entry: QcLogEntry }) {
  const { mode } = useAppTheme()
  const tone = getLogCategoryTone(String(entry.category), mode === 'dark')
  return (
    <Box
      component="li"
      className="animate-fade-in"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '158px 132px minmax(0, 1fr)',
        },
        gap: { xs: 0.5, sm: 1.25 },
        alignItems: 'start',
        px: 1.25,
        py: 0.85,
        borderBottom: '1px solid',
        borderColor: 'divider',
        fontSize: '12px',
        listStyle: 'none',
      }}
    >
      <Typography
        component="time"
        dateTime={new Date(entry.at).toISOString()}
        sx={{
          fontSize: '11px',
          fontFamily: fontFamilyMono,
          color: 'text.secondary',
          whiteSpace: 'nowrap',
          pt: 0.15,
        }}
        title={new Date(entry.at).toISOString()}
      >
        {formatTimestamp(entry.at)}
      </Typography>
      <Chip
        size="small"
        label={entry.category}
        sx={{
          height: 20,
          maxWidth: '100%',
          fontSize: '9.5px',
          fontWeight: 700,
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: tone.border,
          bgcolor: tone.bg,
          color: tone.text,
          justifySelf: { sm: 'start' },
          '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.35, wordBreak: 'break-word' }}>
          {entry.message}
        </Typography>
        {(entry.detail || entry.batchLabel) && (
          <Typography
            sx={{
              mt: 0.25,
              fontSize: '11px',
              color: 'text.secondary',
              fontFamily: fontFamilyMono,
              wordBreak: 'break-word',
            }}
          >
            {[entry.batchLabel, entry.detail].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
    </Box>
  )
})

export function LogsPage() {
  const { logs, categories, clearLogs } = useLogs()
  const { status } = useBatchDemo()
  const { showToast } = useToast()
  const { mode } = useAppTheme()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  /** `null` = ALL (no category filter). Single-select only. */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(false)
  const [copySucceeded, setCopySucceeded] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const prevLenRef = useRef(logs.length)
  const copyResetTimerRef = useRef<number | null>(null)

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of logs) {
      const key = String(entry.category)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q && !selectedCategory) return logs

    return logs.filter((entry) => {
      if (selectedCategory && String(entry.category) !== selectedCategory) return false
      if (!q) return true
      const hay = `${entry.category} ${entry.message} ${entry.detail ?? ''} ${entry.batchLabel ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [logs, search, selectedCategory])

  // Chronological (oldest → newest) for natural container auto-scroll.
  const { start, end } = getPageItemRange(page, pageSize, filtered.length)
  const visibleRows = filtered.slice(start, end)

  const selectCategory = useCallback((category: string) => {
    // Single-select: choosing another filter replaces the previous one.
    // Clicking the active filter again returns to ALL.
    setSelectedCategory((prev) => (prev === category ? null : category))
    setPage(1)
  }, [])

  const handleClear = useCallback(() => {
    clearLogs()
    setPage(1)
    setSearch('')
    setSelectedCategory(null)
    showToast('Logs cleared', 'info')
  }, [clearLogs, showToast])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  const handleCopyFiltered = useCallback(async () => {
    if (filtered.length === 0) {
      showToast('No logs to copy for the current filter', 'info')
      return
    }
    const text = buildFilteredLogsClipboardText(filtered)
    try {
      await navigator.clipboard.writeText(text)
      setCopySucceeded(true)
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopySucceeded(false)
        copyResetTimerRef.current = null
      }, COPY_SUCCESS_RESET_MS)
    } catch {
      setCopySucceeded(false)
      showToast('Could not copy logs to clipboard', 'error')
    }
  }, [filtered, showToast])

  const scrollListToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!listRef.current) return
        listRef.current.scrollTop = listRef.current.scrollHeight
      })
    })
  }, [])

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev
      if (next) {
        const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
        setPage(lastPage)
        scrollListToBottom()
      }
      return next
    })
  }, [filtered.length, pageSize, scrollListToBottom])

  // When auto-scroll is on and new logs arrive, jump to last page.
  useEffect(() => {
    const grew = logs.length > prevLenRef.current
    prevLenRef.current = logs.length
    if (!autoScroll || !grew) return
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
    setPage(lastPage)
  }, [logs.length, filtered.length, autoScroll, pageSize])

  // Scroll the log container after the last page renders.
  useEffect(() => {
    if (!autoScroll) return
    scrollListToBottom()
  }, [autoScroll, page, pageSize, filtered.length, logs.length, scrollListToBottom])

  // Keep page in range when filters shrink the result set.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
    if (page > maxPage) setPage(maxPage)
  }, [filtered.length, pageSize, page])

  const filterCategories = useMemo(() => {
    return categories.filter((c) => (categoryCounts.get(c) ?? 0) > 0 || LOG_ALWAYS_SHOW.has(c))
  }, [categories, categoryCounts])

  return (
    <PageFrame
      title="Logs"
      subtitle="Color-coded tool events with search, filters, and container-only auto-scroll."
      actions={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={copySucceeded ? 'Copied' : 'Copy logs matching current search and filter'}>
            <span>
              <IconButton
                size="small"
                onClick={() => void handleCopyFiltered()}
                disabled={filtered.length === 0}
                aria-label={copySucceeded ? 'Logs copied to clipboard' : 'Copy filtered logs'}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 0.5,
                  border: '1px solid',
                  borderColor: copySucceeded ? 'success.main' : 'divider',
                  color: copySucceeded ? 'success.main' : 'text.secondary',
                  bgcolor: copySucceeded
                    ? (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(34, 197, 94, 0.16)'
                          : 'rgba(34, 197, 94, 0.14)'
                    : 'transparent',
                  transition:
                    'color 160ms ease, border-color 160ms ease, background-color 160ms ease',
                  '&:hover': {
                    color: copySucceeded ? 'success.main' : 'text.primary',
                    bgcolor: copySucceeded
                      ? (theme) =>
                          theme.palette.mode === 'dark'
                            ? 'rgba(34, 197, 94, 0.22)'
                            : 'rgba(34, 197, 94, 0.2)'
                      : 'action.hover',
                  },
                }}
              >
                {copySucceeded ? (
                  <CheckRoundedIcon sx={{ fontSize: 18 }} />
                ) : (
                  <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<DeleteOutlineOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={handleClear}
            disabled={logs.length === 0}
            sx={{ height: 32, fontSize: '12px', borderRadius: 0.5 }}
          >
            Clear Logs
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1, minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search logs…"
            sx={{
              minWidth: { xs: '100%', sm: 240 },
              flex: 1,
              maxWidth: 420,
              '& .MuiInputBase-root': { height: 32, fontSize: '12px', borderRadius: 0.5 },
            }}
          />
          <Typography sx={{ fontSize: '11px', color: 'text.secondary', fontFamily: fontFamilyMono }}>
            {filtered.length}/{logs.length}
            {status === 'running' ? ' · live' : ''}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {(() => {
            const allSelected = selectedCategory == null
            const isDark = mode === 'dark'
            const activeAll = {
              borderColor: '#3b82f6 !important',
              color: '#ffffff !important',
              bgcolor: '#2563eb !important',
              backgroundColor: '#2563eb !important',
              boxShadow: isDark
                ? '0 0 0 1px #3b82f6, 0 0 12px rgba(37,99,235,0.35)'
                : '0 0 0 1px rgba(37,99,235,0.25), 0 1px 2px rgba(24,24,27,0.12)',
            } as const
            return (
              <Chip
                size="small"
                label="ALL"
                onClick={() => {
                  setSelectedCategory(null)
                  setPage(1)
                }}
                variant="outlined"
                sx={{
                  height: 24,
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  border: '1px solid',
                  borderColor: allSelected ? '#3b82f6' : isDark ? '#3f3f46' : '#d4d4d8',
                  color: allSelected ? '#ffffff' : isDark ? '#e4e4e7' : '#3f3f46',
                  bgcolor: allSelected ? '#2563eb' : 'transparent',
                  backgroundImage: 'none',
                  boxShadow: allSelected ? activeAll.boxShadow : 'none',
                  transition:
                    'background-color 80ms ease, border-color 80ms ease, color 80ms ease, box-shadow 80ms ease',
                  '& .MuiChip-label': { px: 1 },
                  '&&:hover, &&:focus, &&:active, &&.Mui-focusVisible, &&.MuiChip-clickable:hover, &&.MuiChip-clickable:focus, &&.MuiChip-clickable:active':
                    activeAll,
                  ...(allSelected ? { '&&': activeAll } : null),
                }}
              />
            )
          })()}
          {filterCategories.map((category) => (
            <CategoryChip
              key={category}
              category={category}
              count={categoryCounts.get(category) ?? 0}
              selected={selectedCategory === category}
              onToggle={selectCategory}
            />
          ))}
        </Box>

        <Paper
          sx={{
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flex: 1,
            minHeight: 280,
          }}
        >
          <Box
            role="switch"
            aria-checked={autoScroll}
            aria-label="Auto-scroll log list"
            onClick={toggleAutoScroll}
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.25,
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: autoScroll ? 'success.main' : 'divider',
              bgcolor: autoScroll
                ? mode === 'dark'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(34, 197, 94, 0.14)'
                : 'action.hover',
              cursor: 'pointer',
            }}
          >
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: autoScroll ? 'success.main' : 'text.secondary',
              }}
            >
              LOG LIST HEADER
            </Typography>
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: autoScroll ? 'success.main' : 'text.secondary',
              }}
            >
              AUTO-SCROLL {autoScroll ? 'ON' : 'OFF'}
            </Typography>
          </Box>
          <Box
            role="switch"
            aria-checked={autoScroll}
            aria-label="Auto-scroll log list"
            onClick={toggleAutoScroll}
            sx={{
              display: { xs: 'none', sm: 'grid' },
              gridTemplateColumns: '158px 132px minmax(0, 1fr)',
              gap: 1.25,
              px: 1.25,
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: autoScroll ? 'success.main' : 'divider',
              bgcolor: autoScroll
                ? mode === 'dark'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(34, 197, 94, 0.14)'
                : 'action.hover',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 120ms ease, border-color 120ms ease',
            }}
          >
            {LOGS_HEADER_COLUMNS.map((h) => (
              <Typography
                key={h}
                sx={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: autoScroll ? 'success.main' : 'text.secondary',
                }}
              >
                {h === 'Message'
                  ? `MESSAGE · AUTO-SCROLL ${autoScroll ? 'ON' : 'OFF'}`
                  : h.toUpperCase()}
              </Typography>
            ))}
          </Box>

          <Box
            ref={listRef}
            sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}
          >
            {filtered.length === 0 ? (
              <Typography sx={{ fontSize: '12px', color: 'text.secondary', p: 3 }}>
                {logs.length === 0
                  ? 'No log entries yet. Start QC from Live Output to stream tool events here.'
                  : 'No logs match the current search or category filters.'}
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, p: 0 }}>
                {visibleRows.map((entry) => (
                  <LogRow key={entry.id} entry={entry} />
                ))}
              </Box>
            )}
          </Box>

          <Pagination
            totalItems={filtered.length}
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
      </Box>
    </PageFrame>
  )
}

/** Always offer core filters even before the first matching event. */
const LOG_ALWAYS_SHOW = new Set([
  'SYSTEM',
  'SCRAPING',
  'AI',
  'QC',
  'LOGIN',
  'LOGIN SUCCESSFUL',
  'SESSION EXPIRED',
  'ERROR',
])
