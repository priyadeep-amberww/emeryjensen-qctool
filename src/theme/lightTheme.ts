import type { ThemeOptions } from '@mui/material/styles'
import { typographyConfig } from './typography'

export const lightTheme: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#64748b',
      light: '#94a3b8',
      dark: '#475569',
      contrastText: '#ffffff',
    },
    success: {
      main: '#16a34a',
      light: '#22c55e',
      dark: '#15803d',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706',
      light: '#f59e0b',
      dark: '#b45309',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0284c7',
      light: '#0ea5e9',
      dark: '#0369a1',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f4f4f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#18181b',
      secondary: '#71717a',
      disabled: '#a1a1aa',
    },
    divider: '#e4e4e7',
  },
  typography: typographyConfig,
  shape: {
    borderRadius: 2, // Standard non-rounded components
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f4f4f5',
          color: '#18181b',
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
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: '#e4e4e7',
          color: '#18181b',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: 'rgba(0, 0, 0, 0.03)',
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
          color: '#71717a',
          transition: 'all 120ms ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            color: '#18181b',
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
          border: '1px solid #e4e4e7',
          backgroundColor: '#ffffff',
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
          border: '1px solid #e4e4e7',
          backgroundColor: '#ffffff',
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
          backgroundColor: '#ffffff',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#e4e4e7',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#cbd5e1',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#2563eb',
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
          borderColor: '#e4e4e7',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '11px',
          backgroundColor: '#18181b',
          color: '#ffffff',
          border: '1px solid #27272a',
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
          borderColor: '#e4e4e7',
          color: '#18181b',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#f8fafc',
          color: '#64748b',
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
          color: '#71717a !important',
          transitionDuration: '200ms',
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#ffffff !important',
            '& + .MuiSwitch-track': {
              backgroundColor: '#2563eb !important',
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 22,
          height: 22,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)',
          borderRadius: '50%',
        },
        track: {
          borderRadius: 13,
          backgroundColor: '#e4e4e7 !important',
          opacity: 1,
        },
      },
    },
  },
}
