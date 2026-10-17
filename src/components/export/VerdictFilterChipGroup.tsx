import { Box, Button } from '@mui/material'
import type { ExportVerdictCounts, ExportVerdictFilter } from '../../utils/qcExport'

export const VERDICT_FILTER_OPTIONS: { key: ExportVerdictFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pass', label: 'Pass' },
  { key: 'fail', label: 'Fail' },
  { key: 'manual', label: 'Manual review' },
  { key: 'exceptions', label: 'Exceptions' },
]

export const LIVE_OUTPUT_VERDICT_FILTER_KEYS: ExportVerdictFilter[] = ['all', 'pass', 'fail', 'manual']

type VerdictFilterChipGroupProps = {
  value: ExportVerdictFilter
  onChange: (filter: ExportVerdictFilter) => void
  counts: ExportVerdictCounts
  disabled?: boolean
  isDark: boolean
  compact?: boolean
  filterKeys?: ExportVerdictFilter[]
}

export function VerdictFilterChipGroup({
  value,
  onChange,
  counts,
  disabled = false,
  isDark,
  compact = false,
  filterKeys,
}: VerdictFilterChipGroupProps) {
  const options = filterKeys
    ? VERDICT_FILTER_OPTIONS.filter((option) => filterKeys.includes(option.key))
    : VERDICT_FILTER_OPTIONS
  const border = isDark ? '#2a2a2a' : 'rgba(15,23,42,0.12)'
  const selectedBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(24,24,27,0.08)'
  const selectedBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(24,24,27,0.18)'

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: compact ? 0.75 : 1,
      }}
    >
      {options.map((option) => {
        const selected = value === option.key
        return (
          <Button
            key={option.key}
            size="small"
            variant="outlined"
            color="inherit"
            disabled={disabled}
            onClick={() => onChange(option.key)}
            sx={{
              minHeight: compact ? 28 : 32,
              px: compact ? 1.1 : 1.35,
              py: compact ? 0.35 : 0.5,
              fontSize: compact ? '11px' : '12px',
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
                bgcolor: selected
                  ? selectedBg
                  : isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(15,23,42,0.04)',
                borderColor: selected ? selectedBorder : border,
              },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            {option.label} ({counts[option.key]})
          </Button>
        )
      })}
    </Box>
  )
}
