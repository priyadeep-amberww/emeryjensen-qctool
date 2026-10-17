import React from 'react'
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  Typography,
  Tooltip,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import { useAppTheme } from '../../theme'

export type NavItemKey =
  | 'upload'
  | 'live'
  | 'export'
  | 'exportCustomize'
  | 'logs'
  | 'sandbox'
  | 'costs'
  | 'credentials'
  | 'settings'
  | 'brandAlias'
  | 'bitrix24'

interface NavItem {
  id: NavItemKey
  label: string
  icon: React.ReactElement
}

export const navItems: NavItem[] = [
  { id: 'upload', label: 'UPLOAD', icon: <UploadFileOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'live', label: 'LIVE OUTPUT', icon: <TerminalOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'export', label: 'EXPORT', icon: <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'exportCustomize', label: 'EXPORT CUSTOM', icon: <TuneOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'logs', label: 'LOGS', icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'sandbox', label: 'SANDBOX', icon: <ScienceOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'costs', label: 'AI COSTS', icon: <PaymentsOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'credentials', label: 'CREDENTIALS', icon: <VpnKeyOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'settings', label: 'SETTINGS', icon: <SettingsOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'brandAlias', label: 'BRAND ALIAS', icon: <StyleOutlinedIcon sx={{ fontSize: 16 }} /> },
  { id: 'bitrix24', label: 'BITRIX24', icon: <HubOutlinedIcon sx={{ fontSize: 16 }} /> },
]

interface AppSidebarProps {
  currentTab: NavItemKey
  onSelectTab: (tab: NavItemKey) => void
  isOpen: boolean
  onToggle: () => void
  menuLabel?: string
}

const RAIL = 48
const OPEN = 200

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onToggle,
  menuLabel = 'MAIN MENU',
}) => {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  return (
    <Box
      component="nav"
      sx={{
        width: isOpen ? OPEN : RAIL,
        minWidth: isOpen ? OPEN : RAIL,
        height: '100%',
        bgcolor: isDark ? '#0c0c0d' : '#f8fafc',
        borderRight: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 160ms cubic-bezier(0.2, 0, 0, 1), min-width 160ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse menu' : 'Expand menu'}
        sx={{
          height: 44,
          minHeight: 44,
          width: '100%',
          m: 0,
          p: 0,
          pl: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          border: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'transparent',
          color: isDark ? '#e5e7eb' : '#0f172a',
          cursor: 'pointer',
          textAlign: 'left',
          flexShrink: 0,
          '&:hover': { bgcolor: isDark ? '#121214' : '#f1f5f9' },
        }}
      >
        <MenuIcon sx={{ fontSize: 18, flexShrink: 0 }} />
        <Typography
          sx={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        >
          {menuLabel}
        </Typography>
      </Box>
      <List disablePadding sx={{ py: 1, overflowY: 'auto', flex: 1 }}>
        {navItems.map((item) => {
          const isActive = currentTab === item.id
          const button = (
            <ListItemButton
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              sx={{
                height: 36,
                pl: '14px',
                pr: 1,
                mb: '2px',
                borderRadius: 0,
                position: 'relative',
                color: isActive ? (isDark ? '#fff' : '#0f172a') : (isDark ? '#9ca3af' : '#64748b'),
                bgcolor: isActive ? (isDark ? '#161619' : '#e2e8f0') : 'transparent',
                '&:hover': {
                  bgcolor: isActive ? (isDark ? '#1c1c20' : '#cbd5e1') : (isDark ? '#121214' : '#f1f5f9'),
                  color: isDark ? '#fff' : '#0f172a',
                },
                '&::before': isActive
                  ? { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', bgcolor: 'primary.main' }
                  : undefined,
              }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <Typography
                sx={{
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  opacity: isOpen ? 1 : 0,
                  transition: 'opacity 120ms ease',
                }}
              >
                {item.label}
              </Typography>
            </ListItemButton>
          )
          return (
            <Tooltip key={item.id} title={isOpen ? '' : item.label} placement="right" arrow disableHoverListener={isOpen}>
              {button}
            </Tooltip>
          )
        })}
      </List>
    </Box>
  )
}
