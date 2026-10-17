import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../types/settings'
import { loadAppSettings, saveAppSettings } from '../utils/settingsStorage'
import { logSettingUpdated, logSettingsReset } from '../services/settingsLogging'
import { useLogs } from './LogsContext'

type SettingsContextValue = {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function formatSettingValue(key: keyof AppSettings, value: AppSettings[keyof AppSettings]): string {
  if (typeof value === 'boolean') return value ? 'ON' : 'OFF'
  if (key.endsWith('Percent')) return `${value}%`
  return String(value)
}

function describeSettingChange(
  key: keyof AppSettings,
  prev: AppSettings[keyof AppSettings],
  next: AppSettings[keyof AppSettings],
): string {
  return `${key}: ${formatSettingValue(key, prev)} → ${formatSettingValue(key, next)}`
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { appendLog } = useLogs()
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings)

  useEffect(() => {
    saveAppSettings(settings)
  }, [settings])

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch }
        for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
          if (prev[key] !== next[key]) {
            logSettingUpdated(appendLog, describeSettingChange(key, prev[key], next[key]))
          }
        }
        return next
      })
    },
    [appendLog],
  )

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_APP_SETTINGS })
    logSettingsReset(appendLog)
  }, [appendLog])

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSettings, resetSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
