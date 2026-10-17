import { memo } from 'react'
import { Chip, Tooltip } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { formatQcToolCodename, QC_TOOL_CODENAME_LENGTH } from '../../config/qcTool'
import { useQcToolCodename, useQcToolVendorDisplayName } from '../../context/QcToolConfigContext'
import { fontFamilyMono } from '../../theme/typography'

export type QcToolCodenameProps = {
  /** Override context codename (e.g. Storybook); must be configurable to four characters. */
  codename?: string
  tooltip?: string
}

export const QcToolCodename = memo(function QcToolCodename({
  codename: codenameProp,
  tooltip,
}: QcToolCodenameProps) {
  const contextCodename = useQcToolCodename()
  const vendorDisplayName = useQcToolVendorDisplayName()
  const display = codenameProp != null ? formatQcToolCodename(codenameProp) : contextCodename
  const shortLabel = display.slice(0, QC_TOOL_CODENAME_LENGTH)
  const tip =
    tooltip ??
    (vendorDisplayName
      ? `Vendor short name · ${shortLabel.trim() || '—'} (${vendorDisplayName})`
      : `Vendor short name · ${shortLabel.trim() || '—'}`)

  return (
    <Tooltip title={tip} placement="bottom-end">
      <Chip
        component="span"
        label={shortLabel}
        size="small"
        aria-label={tip}
        sx={(theme) => {
          const isDark = theme.palette.mode === 'dark'
          const primary = theme.palette.primary.main
          return {
            height: 28,
            minWidth: 58,
            flexShrink: 0,
            borderRadius: 0.5,
            fontFamily: fontFamilyMono,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.11em',
            color: isDark ? theme.palette.primary.light : theme.palette.primary.dark,
            bgcolor: alpha(primary, isDark ? 0.14 : 0.09),
            border: '1px solid',
            borderColor: isDark
              ? alpha(primary, 0.28)
              : alpha(primary, 0.22),
            transition: theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
            '& .MuiChip-label': {
              px: 1.15,
              lineHeight: 1,
            },
            '&:hover': {
              bgcolor: alpha(primary, isDark ? 0.2 : 0.12),
              borderColor: alpha(primary, isDark ? 0.4 : 0.32),
            },
          }
        }}
      />
    </Tooltip>
  )
})
