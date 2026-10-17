import { Box, Button, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { QcProcessStatus } from '../../types/qc'

type QcControlBarProps = {
  status: QcProcessStatus
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  /** When false, Start is hidden from the idle flow (e.g. batches begin on Upload). */
  allowStart?: boolean
}

/** Shared with Live Output header actions (Reset, row actions). */
export const liveOutputControlBtnSx = {
  height: 32,
  minWidth: 0,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  lineHeight: 1,
  borderRadius: 0.5,
  px: 1.5,
  boxShadow: 'none',
  textTransform: 'uppercase',
} as const

/** Pure availability map — reusable for any vendor QC tool. */
export function getQcControlAvailability(status: QcProcessStatus) {
  const isIdleLike = status === 'idle' || status === 'done' || status === 'stopped'
  return {
    canStart: isIdleLike,
    canPause: status === 'running',
    canResume: status === 'paused',
    canStop: status === 'running' || status === 'paused',
  }
}

function statusLabel(status: QcProcessStatus): string {
  switch (status) {
    case 'running':
      return 'RUNNING'
    case 'paused':
      return 'PAUSED'
    case 'stopped':
      return 'STOPPED'
    case 'done':
      return 'DONE'
    default:
      return 'IDLE'
  }
}

function statusChipSx(status: QcProcessStatus, isDark: boolean): SxProps<Theme> {
  const base = {
    height: 32,
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    borderRadius: 0.5,
    border: '1px solid',
    '& .MuiChip-label': { px: 1.25, lineHeight: 1 },
  } as const

  switch (status) {
    case 'running':
      return {
        ...base,
        bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
        color: 'primary.main',
        borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(37, 99, 235, 0.35)',
      }
    case 'paused':
      return {
        ...base,
        bgcolor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.14)',
        color: 'warning.main',
        borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.4)',
      }
    case 'stopped':
      return {
        ...base,
        bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.1)',
        color: 'error.main',
        borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.35)',
      }
    case 'done':
      return {
        ...base,
        bgcolor: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.15)',
        color: 'success.main',
        borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.35)',
      }
    default:
      return {
        ...base,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'action.hover',
        color: 'text.secondary',
        borderColor: 'divider',
      }
  }
}

export function QcControlBar({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  allowStart = true,
}: QcControlBarProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { canStart, canPause, canResume, canStop } = getQcControlAvailability(status)
  const canStartEffective = canStart && allowStart

  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
      role="group"
      aria-label="QC process controls"
    >
      <Button
        variant="contained"
        disabled={!canStartEffective}
        onClick={onStart}
        aria-label="Start QC process"
        title={canStartEffective ? 'Start QC' : 'Start QC from Upload after validation'}
        sx={liveOutputControlBtnSx}
      >
        Start
      </Button>
      <Button
        variant="outlined"
        disabled={!canPause}
        onClick={onPause}
        aria-label="Pause QC process"
        title={canPause ? 'Pause QC' : 'Pause is only available while running'}
        sx={liveOutputControlBtnSx}
      >
        Pause
      </Button>
      <Button
        variant="outlined"
        disabled={!canResume}
        onClick={onResume}
        aria-label="Resume QC process"
        title={canResume ? 'Resume QC' : 'Resume is only available while paused'}
        sx={liveOutputControlBtnSx}
      >
        Resume
      </Button>
      <Button
        variant="outlined"
        disabled={!canStop}
        onClick={onStop}
        aria-label="Stop QC process"
        title={canStop ? 'Stop QC' : 'Stop is only available while running or paused'}
        sx={liveOutputControlBtnSx}
      >
        Stop
      </Button>
      <Chip
        label={statusLabel(status)}
        size="small"
        aria-live="polite"
        sx={statusChipSx(status, isDark)}
      />
    </Box>
  )
}
