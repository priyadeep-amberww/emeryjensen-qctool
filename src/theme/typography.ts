import type { TypographyVariantsOptions } from '@mui/material/styles'

export const fontFamilySans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const fontFamilyMono = "'JetBrains Mono', 'Consolas', 'Cascadia Code', 'Courier New', monospace"

export const typographyConfig: TypographyVariantsOptions = {
  fontFamily: fontFamilySans,
  fontSize: 13,
  htmlFontSize: 16,
  h1: {
    fontFamily: fontFamilySans,
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontFamily: fontFamilySans,
    fontSize: '1.35rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.015em',
  },
  h3: {
    fontFamily: fontFamilySans,
    fontSize: '1.15rem',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  h4: {
    fontFamily: fontFamilySans,
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h5: {
    fontFamily: fontFamilySans,
    fontSize: '0.92rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  h6: {
    fontFamily: fontFamilySans,
    fontSize: '0.82rem',
    fontWeight: 600,
    lineHeight: 1.4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  subtitle1: {
    fontFamily: fontFamilySans,
    fontSize: '0.95rem',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  subtitle2: {
    fontFamily: fontFamilySans,
    fontSize: '0.85rem',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  body1: {
    fontFamily: fontFamilySans,
    fontSize: '0.92rem',
    fontWeight: 400,
    lineHeight: 1.45,
  },
  body2: {
    fontFamily: fontFamilySans,
    fontSize: '0.83rem',
    fontWeight: 400,
    lineHeight: 1.4,
  },
  button: {
    fontFamily: fontFamilySans,
    fontSize: '0.85rem',
    fontWeight: 500,
    textTransform: 'none',
    letterSpacing: '0.01em',
  },
  caption: {
    fontFamily: fontFamilySans,
    fontSize: '0.78rem',
    fontWeight: 400,
    lineHeight: 1.35,
  },
  overline: {
    fontFamily: fontFamilySans,
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}
