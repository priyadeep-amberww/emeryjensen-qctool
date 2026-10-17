import React from 'react'
import { Box, Typography } from '@mui/material'
import { useAppTheme } from '../../theme'

interface PageFrameProps {
  title: string
  subtitle: string
  actions?: React.ReactNode
  children: React.ReactNode
}

function thinScrollbarSx(isDark: boolean) {
  return {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: isDark ? 'rgba(82,82,91,0.85) transparent' : 'rgba(148,163,184,0.7) transparent',
    '&::-webkit-scrollbar': { width: 5, height: 5 },
    '&::-webkit-scrollbar-track': { background: 'transparent', marginBlock: 6 },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: isDark ? 'rgba(82,82,91,0.9)' : 'rgba(148,163,184,0.75)',
      borderRadius: 999,
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: isDark ? 'rgba(113,113,122,0.95)' : 'rgba(100,116,139,0.85)',
    },
    '&::-webkit-scrollbar-corner': { background: 'transparent' },
  }
}

export const PageFrame: React.FC<PageFrameProps> = ({ title, subtitle, actions, children }) => {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...thinScrollbarSx(isDark),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.5,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.01em' }}>
            {title}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>{subtitle}</Typography>
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>{actions}</Box>}
      </Box>
      {children}
    </Box>
  )
}
