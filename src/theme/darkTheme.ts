import type { ThemeOptions } from '@mui/material/styles'
import { typographyConfig } from './typography'

export const darkTheme: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6', // Clean enterprise blue
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#71717a',
      light: '#a1a1aa',
      dark: '#52525b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
      contrastText: '#ffffff',
    },
    info: {
      main: '#06b6d4',
      light: '#22d3ee',
      dark: '#0891b2',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0c0c0d', // Deep dark enterprise backdrop
      paper: '#161618',   // Charcoal card/panel surface
    },
    text: {
      primary: '#f4f4f5',
      secondary: '#a1a1aa',
      disabled: '#52525b',
    },
    divider: '#262629',
  },
  typography: typographyConfig,
  shape: {
    borderRadius: 2, // Standard non-rounded components
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0c0c0d',
          color: '#f4f4f5',
        },
      },
    },
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
    },
    MuiButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 2,
          fontWeight: 500,
          padding: '5px 12px',
          minHeight: '30px',
          textTransform: 'none',
          transition: 'all 120ms ease-in-out',
          '&:hover': {
            transform: 'none',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#2f2f35',
          color: '#f4f4f5',
          '&:hover': {
            borderColor: '#3f3f46',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 2,
          padding: 6,
          color: '#a1a1aa',
          transition: 'all 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            color: '#f4f4f5',
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 2,
          border: '1px solid #262629',
          backgroundColor: '#161618',
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 2,
          border: '1px solid #262629',
          backgroundColor: '#161618',
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '12.5px',
        },
        input: {
          padding: '6px 10px',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          backgroundColor: '#111113',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#2f2f35',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3f3f46',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
        },
        input: {
          padding: '7px 10px',
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          fontSize: '11px',
          height: '22px',
          fontWeight: 500,
          borderRadius: 2,
        },
        outlined: {
          borderColor: '#2f2f35',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '11px',
          backgroundColor: '#1c1c1f',
          color: '#f4f4f5',
          border: '1px solid #2f2f35',
          padding: '4px 8px',
          borderRadius: 2,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '12px',
          padding: '8px 12px',
          borderColor: '#262629',
          color: '#f4f4f5',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#111113',
          color: '#a1a1aa',
          textTransform: 'uppercase',
          fontSize: '10.5px',
          letterSpacing: '0.04em',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
        },
        switchBase: {
          padding: 0,
          margin: 2,
          color: '#a1a1aa !important',
          transitionDuration: '200ms',
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#ffffff !important',
            '& + .MuiSwitch-track': {
              backgroundColor: '#3b82f6 !important',
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 22,
          height: 22,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
          borderRadius: '50%',
        },
        track: {
          borderRadius: 13,
          backgroundColor: '#262629 !important',
          opacity: 1,
        },
      },
    },
  },
}
