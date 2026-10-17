/** Exponential backoff delay for a given attempt (1-based). */
export function exponentialBackoffMs(attempt: number, baseMs: number, maxMs = 120_000): number {
  const safeAttempt = Math.max(1, Math.floor(attempt))
  const safeBase = Math.max(100, Math.floor(baseMs))
  const delay = safeBase * 2 ** (safeAttempt - 1)
  return Math.min(delay, maxMs)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
