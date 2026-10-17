import { memo } from 'react'
import { Chip, useTheme, type ChipProps, type SxProps, type Theme } from '@mui/material'
import type { CaptureStatus } from '../../types/qc'
import { captureStatusLabel } from '../../services/qc/listingQcMapper'

type CaptureTone = 'success' | 'warning' | 'error' | 'default'

function captureTone(status: CaptureStatus): CaptureTone {
  if (status === 'captured') return 'success'
  if (status === 'not_on_portal' || status === 'bad_parse') return 'warning'
  if (status === 'sp_api_failed') return 'error'
  return 'default'
}

function captureChipColor(tone: CaptureTone): ChipProps['color'] {
  if (tone === 'success') return 'success'
  if (tone === 'warning') return 'warning'
  if (tone === 'error') return 'error'
  return 'default'
}

function outlineSx(tone: CaptureTone, mode: 'light' | 'dark'): SxProps<Theme> {
  if (mode !== 'dark' || tone === 'default') return {}
  return {
    bgcolor: 'transparent !important',
    border: '1px solid',
    borderColor: `${tone}.main`,
    color: `${tone}.main`,
    '& .MuiChip-label': { color: 'inherit', px: 0.85 },
  }
}

export type CaptureStatusChipProps = {
  status: CaptureStatus
  density?: 'compact' | 'default'
  sx?: SxProps<Theme>
} & Omit<ChipProps, 'label' | 'color' | 'variant' | 'children'>

export const CaptureStatusChip = memo(function CaptureStatusChip({
  status,
  density = 'compact',
  sx,
  size = 'small',
  ...rest
}: CaptureStatusChipProps) {
  const theme = useTheme()
  const tone = captureTone(status)
  const isDark = theme.palette.mode === 'dark'
  const densitySx: SxProps<Theme> =
    density === 'compact'
      ? { height: 20, fontSize: '9.5px', fontWeight: 700, borderRadius: 0.5 }
      : { height: 24, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }

  return (
    <Chip
      {...rest}
      size={size}
      label={captureStatusLabel(status).toUpperCase()}
      color={captureChipColor(tone)}
      variant={isDark ? 'outlined' : 'filled'}
      sx={
        [
          densitySx,
          outlineSx(tone, theme.palette.mode),
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ] as SxProps<Theme>
      }
    />
  )
})
