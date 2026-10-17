import { memo } from 'react'
import { Chip, useTheme, type ChipProps, type SxProps, type Theme } from '@mui/material'
import type { QcVerdict } from '../../types/qc'

export type QcVerdictTone = 'success' | 'warning' | 'error'

export function verdictTone(verdict: QcVerdict): QcVerdictTone {
  if (verdict === 'PASS') return 'success'
  if (verdict === 'FAIL') return 'error'
  return 'warning'
}

export function formatVerdictLabel(verdict: QcVerdict): string {
  return verdict.replace(/_/g, ' ')
}

/** Dark-mode: surrounding UI bg, colored text + border. Light: filled chip. */
export function verdictChipSx(tone: QcVerdictTone, mode: 'light' | 'dark'): SxProps<Theme> {
  if (mode !== 'dark') return {}

  return {
    bgcolor: 'transparent !important',
    backgroundColor: 'transparent !important',
    backgroundImage: 'none',
    border: '1px solid',
    borderColor: `${tone}.main`,
    color: `${tone}.main`,
    '& .MuiChip-label': {
      color: 'inherit',
      px: 0.85,
    },
  }
}

export type QcVerdictChipProps = {
  verdict: QcVerdict
  /** Compact table chip vs slightly larger strip chip */
  density?: 'compact' | 'default'
  sx?: SxProps<Theme>
} & Omit<ChipProps, 'label' | 'color' | 'variant' | 'children'>

/**
 * Shared PASS / FAIL / MANUAL REVIEW chip for Live Output, Export, and Sandbox.
 * Dark mode uses outline + colored text on a transparent (surrounding) background.
 */
export const QcVerdictChip = memo(function QcVerdictChip({
  verdict,
  density = 'compact',
  sx,
  size = 'small',
  ...rest
}: QcVerdictChipProps) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const tone = verdictTone(verdict)
  const isDark = mode === 'dark'

  const densitySx: SxProps<Theme> =
    density === 'compact'
      ? { height: 20, fontSize: '9.5px', fontWeight: 700, borderRadius: 0.5 }
      : { height: 28, fontSize: '12px', fontWeight: 800, borderRadius: 0.5, px: 0.5 }

  return (
    <Chip
      {...rest}
      size={size}
      label={formatVerdictLabel(verdict)}
      color={tone}
      variant={isDark ? 'outlined' : 'filled'}
      sx={[densitySx, verdictChipSx(tone, mode), ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>}
    />
  )
})
