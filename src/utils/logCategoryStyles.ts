/** Color tokens for log category filter chips — light & dark friendly. */

export type LogCategoryTone = {
  /** Soft accent used by log row badges (not filters). */
  border: string
  bg: string
  text: string
  /** Filter chip: idle / hover / active */
  idleBorder: string
  idleBg: string
  idleText: string
  hoverBorder: string
  hoverBg: string
  hoverText: string
  activeBorder: string
  activeBg: string
  activeText: string
}

type TonePair = { dark: LogCategoryTone; light: LogCategoryTone }

function tone(opts: {
  darkIdle: string
  darkActive: string
  darkActiveText: string
  lightIdle: string
  lightActive: string
  lightActiveText: string
  darkBadgeBg: string
  lightBadgeBg: string
}): TonePair {
  return {
    dark: {
      border: opts.darkIdle,
      bg: opts.darkBadgeBg,
      text: opts.darkIdle,
      idleBorder: '#3f3f46',
      idleBg: 'transparent',
      idleText: opts.darkIdle,
      hoverBorder: opts.darkIdle,
      hoverBg: opts.darkBadgeBg,
      hoverText: opts.darkIdle,
      activeBorder: opts.darkActive,
      activeBg: opts.darkActive,
      activeText: opts.darkActiveText,
    },
    light: {
      border: opts.lightIdle,
      bg: opts.lightBadgeBg,
      text: opts.lightIdle,
      idleBorder: '#d4d4d8',
      idleBg: 'transparent',
      idleText: opts.lightIdle,
      hoverBorder: opts.lightIdle,
      hoverBg: opts.lightBadgeBg,
      hoverText: opts.lightIdle,
      activeBorder: opts.lightActive,
      activeBg: opts.lightActive,
      activeText: opts.lightActiveText,
    },
  }
}

const TONES: Record<string, TonePair> = {
  SETTINGS: tone({
    darkIdle: '#a78bfa',
    darkActive: '#7c3aed',
    darkActiveText: '#f5f3ff',
    lightIdle: '#6d28d9',
    lightActive: '#7c3aed',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(124, 58, 237, 0.18)',
    lightBadgeBg: '#f3e8ff',
  }),
  SYSTEM: tone({
    darkIdle: '#a1a1aa',
    darkActive: '#52525b',
    darkActiveText: '#fafafa',
    lightIdle: '#52525b',
    lightActive: '#3f3f46',
    lightActiveText: '#fafafa',
    darkBadgeBg: '#27272a',
    lightBadgeBg: '#f4f4f5',
  }),
  SCRAPING: tone({
    darkIdle: '#22d3ee',
    darkActive: '#0891b2',
    darkActiveText: '#ecfeff',
    lightIdle: '#0e7490',
    lightActive: '#0e7490',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(8, 145, 178, 0.18)',
    lightBadgeBg: '#ecfeff',
  }),
  AI: tone({
    darkIdle: '#c084fc',
    darkActive: '#7c3aed',
    darkActiveText: '#f5f3ff',
    lightIdle: '#6d28d9',
    lightActive: '#6d28d9',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(124, 58, 237, 0.22)',
    lightBadgeBg: '#f5f3ff',
  }),
  QC: tone({
    darkIdle: '#60a5fa',
    darkActive: '#2563eb',
    darkActiveText: '#eff6ff',
    lightIdle: '#1d4ed8',
    lightActive: '#2563eb',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(37, 99, 235, 0.22)',
    lightBadgeBg: '#eff6ff',
  }),
  LOGIN: tone({
    darkIdle: '#fbbf24',
    darkActive: '#d97706',
    darkActiveText: '#fffbeb',
    lightIdle: '#b45309',
    lightActive: '#d97706',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(217, 119, 6, 0.2)',
    lightBadgeBg: '#fffbeb',
  }),
  'LOGIN SUCCESSFUL': tone({
    darkIdle: '#4ade80',
    darkActive: '#16a34a',
    darkActiveText: '#f0fdf4',
    lightIdle: '#15803d',
    lightActive: '#16a34a',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(22, 163, 74, 0.2)',
    lightBadgeBg: '#f0fdf4',
  }),
  'SESSION EXPIRED': tone({
    darkIdle: '#fb923c',
    darkActive: '#ea580c',
    darkActiveText: '#fff7ed',
    lightIdle: '#c2410c',
    lightActive: '#ea580c',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(234, 88, 12, 0.2)',
    lightBadgeBg: '#fff7ed',
  }),
  ERROR: tone({
    darkIdle: '#f87171',
    darkActive: '#dc2626',
    darkActiveText: '#fef2f2',
    lightIdle: '#b91c1c',
    lightActive: '#dc2626',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(220, 38, 38, 0.2)',
    lightBadgeBg: '#fef2f2',
  }),
  WARNING: tone({
    darkIdle: '#facc15',
    darkActive: '#ca8a04',
    darkActiveText: '#fefce8',
    lightIdle: '#a16207',
    lightActive: '#ca8a04',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(202, 138, 4, 0.2)',
    lightBadgeBg: '#fefce8',
  }),
  INFO: tone({
    darkIdle: '#38bdf8',
    darkActive: '#0284c7',
    darkActiveText: '#f0f9ff',
    lightIdle: '#0369a1',
    lightActive: '#0284c7',
    lightActiveText: '#ffffff',
    darkBadgeBg: 'rgba(2, 132, 199, 0.2)',
    lightBadgeBg: '#f0f9ff',
  }),
}

const FALLBACK = TONES.INFO

export function getLogCategoryTone(category: string, isDark: boolean): LogCategoryTone {
  const key = category.trim().toUpperCase()
  const entry = TONES[key] ?? TONES[category] ?? FALLBACK
  return isDark ? entry.dark : entry.light
}
