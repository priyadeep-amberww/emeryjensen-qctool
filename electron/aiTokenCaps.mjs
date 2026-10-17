import fs from 'node:fs/promises'
import path from 'node:path'
import { getStableCredentialsDir } from './credentialsPath.mjs'

const FILE_NAME = 'ai-token-caps.json'

export const AI_TOKEN_CAP_DEFAULTS = {
  inputTokens: 3000,
  outputTokens: 250,
}

const LEGACY_CAP_PAIR = { inputTokens: 1000, outputTokens: 50 }

export const AI_TOKEN_CAP_LIMITS = {
  inputMin: 0,
  inputMax: 5000,
  outputMin: 0,
  outputMax: 1000,
}

function capsPath() {
  return path.join(getStableCredentialsDir(), FILE_NAME)
}

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function normalizeAiTokenCaps(raw) {
  return {
    inputTokens: clampInt(
      raw?.inputTokens,
      AI_TOKEN_CAP_DEFAULTS.inputTokens,
      AI_TOKEN_CAP_LIMITS.inputMin,
      AI_TOKEN_CAP_LIMITS.inputMax,
    ),
    outputTokens: clampInt(
      raw?.outputTokens,
      AI_TOKEN_CAP_DEFAULTS.outputTokens,
      AI_TOKEN_CAP_LIMITS.outputMin,
      AI_TOKEN_CAP_LIMITS.outputMax,
    ),
  }
}

export async function loadAiTokenCaps() {
  try {
    const text = await fs.readFile(capsPath(), 'utf8')
    const raw = JSON.parse(text)
    const input = Number(raw?.inputTokens)
    const output = Number(raw?.outputTokens)
    if (input === LEGACY_CAP_PAIR.inputTokens && output === LEGACY_CAP_PAIR.outputTokens) {
      return { ...AI_TOKEN_CAP_DEFAULTS }
    }
    return normalizeAiTokenCaps(raw)
  } catch {
    return { ...AI_TOKEN_CAP_DEFAULTS }
  }
}

export async function saveAiTokenCaps(raw) {
  const caps = normalizeAiTokenCaps(raw)
  await fs.mkdir(path.dirname(capsPath()), { recursive: true })
  await fs.writeFile(capsPath(), `${JSON.stringify(caps, null, 2)}\n`, 'utf8')
  return caps
}

/**
 * Conservative token estimate for the newer Haiku tokenizer (over-counts slightly).
 * @param {string} text
 */
export function estimateInputTokens(text) {
  const length = String(text ?? '').length
  if (length === 0) return 0
  return Math.ceil(length / 3)
}
