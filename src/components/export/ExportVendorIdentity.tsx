import { Box, Paper, Typography } from '@mui/material'
import { useAppTheme } from '../../theme'
import { useQcToolVendorDisplayName } from '../../context/QcToolConfigContext'

export function ExportVendorIdentity() {
  const vendorDisplayName = useQcToolVendorDisplayName()
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  return (
    <Paper
      sx={{
        p: { xs: 1.75, sm: 2 },
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: isDark ? '#2a2a2a' : 'divider',
        bgcolor: isDark ? '#141416' : '#ffffff',
        height: '100%',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ px: 1, textAlign: 'center', minWidth: 0, width: '100%' }}>
        <Typography
          sx={{
            fontSize: { xs: '16px', sm: '18px' },
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            color: 'text.primary',
            wordBreak: 'break-word',
          }}
        >
          {vendorDisplayName}
        </Typography>
      </Box>
    </Paper>
  )
}
