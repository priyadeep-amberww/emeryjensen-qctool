import { memo } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import { useAppTheme } from '../../theme'
import { fontFamilyMono } from '../../theme/typography'

export type RawExtractPanelProps = {
  title: string
  subtitle?: string
  data: unknown
  emptyMessage?: string
  /** Max height of the scrollable JSON body */
  maxHeight?: number | { xs?: number; md?: number; lg?: number }
}

/**
 * Compact, scrollable JSON extract panel — shared shell for Sandbox raw sources.
 * Images live in QC Comparisons only (not duplicated here).
 */
export const RawExtractPanel = memo(function RawExtractPanel({
  title,
  subtitle,
  data,
  emptyMessage = 'No extract data',
  maxHeight = { xs: 220, lg: 260 },
}: RawExtractPanelProps) {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const hasData = data != null

  return (
    <Paper
      sx={{
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        maxHeight,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.85,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '10px', color: 'text.secondary', mt: 0.15 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1.5,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          fontFamily: fontFamilyMono,
          fontSize: '11px',
          lineHeight: 1.5,
          bgcolor: isDark ? '#09090b' : '#fafafa',
          color: isDark ? '#e4e4e7' : 'text.primary',
          userSelect: 'text',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {hasData ? JSON.stringify(data, null, 2) : emptyMessage}
      </Box>
    </Paper>
  )
})
