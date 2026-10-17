import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { tokenCostUsd } from '../utils/aiPricing'
import { loadAiUsageTotals, saveAiUsageTotals } from '../utils/aiUsageStorage'

type AiUsageContextValue = {
  allTimeInputTokens: number
  allTimeOutputTokens: number
  allTimeCostUsd: number
  recordUsage: (inputTokens: number, outputTokens: number) => void
  resetAllTimeUsage: () => void
}

const AiUsageContext = createContext<AiUsageContextValue | null>(null)

export function AiUsageProvider({ children }: { children: ReactNode }) {
  const [totals, setTotals] = useState(loadAiUsageTotals)

  useEffect(() => {
    saveAiUsageTotals(totals)
  }, [totals])

  const recordUsage = useCallback((inputTokens: number, outputTokens: number) => {
    const input = Math.max(0, inputTokens)
    const output = Math.max(0, outputTokens)
    if (input === 0 && output === 0) return
    setTotals((prev) => ({
      inputTokens: prev.inputTokens + input,
      outputTokens: prev.outputTokens + output,
    }))
  }, [])

  const resetAllTimeUsage = useCallback(() => {
    setTotals({ inputTokens: 0, outputTokens: 0 })
  }, [])

  const value = useMemo(
    () => ({
      allTimeInputTokens: totals.inputTokens,
      allTimeOutputTokens: totals.outputTokens,
      allTimeCostUsd: tokenCostUsd(totals.inputTokens, totals.outputTokens),
      recordUsage,
      resetAllTimeUsage,
    }),
    [totals, recordUsage, resetAllTimeUsage],
  )

  return <AiUsageContext.Provider value={value}>{children}</AiUsageContext.Provider>
}

export function useAiUsage() {
  const ctx = useContext(AiUsageContext)
  if (!ctx) throw new Error('useAiUsage must be used within AiUsageProvider')
  return ctx
}
