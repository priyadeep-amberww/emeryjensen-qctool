import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Bitrix24Settings } from '../types/bitrix24'
import {
  DEFAULT_BITRIX24_SETTINGS,
  loadBitrix24Settings,
  normalizeBitrix24Settings,
  saveBitrix24Settings,
} from '../utils/bitrix24SettingsStorage'
import { useLogs } from './LogsContext'

type Bitrix24SettingsContextValue = {
  bitrix24: Bitrix24Settings
  updateBitrix24: (patch: Partial<Bitrix24Settings>) => void
  resetBitrix24: () => void
}

const Bitrix24SettingsContext = createContext<Bitrix24SettingsContextValue | null>(null)

export function Bitrix24SettingsProvider({ children }: { children: ReactNode }) {
  const { appendLog } = useLogs()
  const [bitrix24, setBitrix24] = useState<Bitrix24Settings>(() => loadBitrix24Settings())

  useEffect(() => {
    saveBitrix24Settings(bitrix24)
  }, [bitrix24])

  const updateBitrix24 = useCallback(
    (patch: Partial<Bitrix24Settings>) => {
      setBitrix24((prev) => {
        const next = normalizeBitrix24Settings({ ...prev, ...patch })
        if (patch.enabled !== undefined && prev.enabled !== next.enabled) {
          appendLog({
            category: 'SYSTEM',
            message: `Bitrix24 notifications ${next.enabled ? 'enabled' : 'disabled'}`,
          })
        }
        return next
      })
    },
    [appendLog],
  )

  const resetBitrix24 = useCallback(() => {
    setBitrix24({ ...DEFAULT_BITRIX24_SETTINGS, templates: { ...DEFAULT_BITRIX24_SETTINGS.templates } })
    appendLog({ category: 'SYSTEM', message: 'Bitrix24 settings reset to defaults' })
  }, [appendLog])

  const value = useMemo(
    () => ({
      bitrix24,
      updateBitrix24,
      resetBitrix24,
    }),
    [bitrix24, updateBitrix24, resetBitrix24],
  )

  return (
    <Bitrix24SettingsContext.Provider value={value}>{children}</Bitrix24SettingsContext.Provider>
  )
}

export function useBitrix24Settings() {
  const ctx = useContext(Bitrix24SettingsContext)
  if (!ctx) throw new Error('useBitrix24Settings must be used within Bitrix24SettingsProvider')
  return ctx
}
