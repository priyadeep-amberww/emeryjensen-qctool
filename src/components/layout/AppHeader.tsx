import React from 'react'
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useAppTheme } from '../../theme'
import { useQcToolVendorDisplayName } from '../../context/QcToolConfigContext'
import { QcToolCodename } from './QcToolCodename'

export const AppHeader: React.FC = () => {
  const { mode, toggleTheme } = useAppTheme()
  const vendorDisplayName = useQcToolVendorDisplayName()
  const isDark = mode === 'dark'

  return (
    <Box
      component="header"
      sx={{
        height: 44,
        minHeight: 44,
        maxHeight: 44,
        px: 1.8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        bgcolor: isDark ? '#0c0c0d' : '#ffffff',
        borderBottom: '1px solid',
        borderColor: 'divider',
        userSelect: 'none',
        zIndex: 100,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            fontSize: '12.5px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'text.primary',
          }}
        >
          EMRY QC TOOL
        </Typography>

        <Chip
          label="v2.4"
          size="small"
          sx={{
            height: 18,
            fontSize: '9.5px',
            fontWeight: 700,
            borderRadius: 0.5,
            bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
            color: 'primary.main',
          }}
        />
      </Box>

      <Tooltip title="Vendor integration">
        <Box
          component="span"
          aria-label={`Vendor: ${vendorDisplayName}`}
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            height: 30,
            maxWidth: { xs: 'min(42vw, 240px)', sm: 'min(36vw, 340px)' },
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 1.5,
            borderRadius: 0.5,
            border: '1px solid #CCC',
            bgcolor: '#000000',
            boxSizing: 'border-box',
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '12.5px',
              fontWeight: 700,
              letterSpacing: '0.03em',
              lineHeight: 1,
              color: '#FFFFFF',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {vendorDisplayName}
          </Typography>
        </Box>
      </Tooltip>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
        <Chip
          label="● ONLINE"
          size="small"
          sx={{
            height: 20,
            fontSize: '9.5px',
            fontWeight: 700,
            borderRadius: 0.5,
            bgcolor: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.15)',
            color: 'success.main',
            border: '1px solid',
            borderColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.3)',
          }}
        />

        <Tooltip title="Reset View & Cache">
          <IconButton
            size="small"
            onClick={() => window.location.reload()}
            sx={{
              width: 28,
              height: 28,
              borderRadius: 0.5,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
            pl: 0.75,
            ml: 0.25,
            borderLeft: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tooltip title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}>
            <IconButton
              size="small"
              onClick={toggleTheme}
              sx={{
                width: 28,
                height: 28,
                borderRadius: 0.5,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
              }}
            >
              {isDark ? (
                <LightModeOutlinedIcon sx={{ fontSize: 16 }} />
              ) : (
                <DarkModeOutlinedIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <QcToolCodename />
        </Box>
      </Box>
    </Box>
  )
}
