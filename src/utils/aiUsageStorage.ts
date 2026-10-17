export const AI_USAGE_STORAGE_KEY = 'grand_qc_ai_usage_all_time'

export type AiUsageTotals = {
  inputTokens: number
  outputTokens: number
}

const EMPTY_TOTALS: AiUsageTotals = { inputTokens: 0, outputTokens: 0 }

export function loadAiUsageTotals(): AiUsageTotals {
  try {
    const raw = localStorage.getItem(AI_USAGE_STORAGE_KEY)
    if (!raw) return EMPTY_TOTALS
    const parsed = JSON.parse(raw) as Partial<AiUsageTotals>
    return {
      inputTokens: Math.max(0, Number(parsed.inputTokens) || 0),
      outputTokens: Math.max(0, Number(parsed.outputTokens) || 0),
    }
  } catch {
    return EMPTY_TOTALS
  }
}

export function saveAiUsageTotals(totals: AiUsageTotals): void {
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(totals))
}
