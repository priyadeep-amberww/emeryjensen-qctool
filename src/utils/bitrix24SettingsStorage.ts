import { BITRIX24_TRIGGER_IDS, DEFAULT_BITRIX24_TEMPLATES } from '../services/bitrix24/defaultTemplates'
import type { QcEngineEventName } from '../services/qc/qcEngineEventBus'
import type { Bitrix24Settings, Bitrix24TriggerId } from '../types/bitrix24'

export const BITRIX24_SETTINGS_STORAGE_KEY = 'grand_qc_bitrix24_settings'

const DEFAULT_TRIGGERS = Object.fromEntries(
  BITRIX24_TRIGGER_IDS.map((id) => [id, true]),
) as Bitrix24Settings['triggers']

export const DEFAULT_BITRIX24_SETTINGS: Bitrix24Settings = {
  enabled: false,
  triggers: DEFAULT_TRIGGERS,
  templates: { ...DEFAULT_BITRIX24_TEMPLATES },
  progressSkuInterval: 10,
  periodicStatusMinutes: 30,
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeTriggers(raw: Partial<Bitrix24Settings['triggers']> | undefined): Bitrix24Settings['triggers'] {
  const out = { ...DEFAULT_TRIGGERS }
  if (!raw) return out
  for (const id of BITRIX24_TRIGGER_IDS) {
    if (typeof raw[id] === 'boolean') out[id] = raw[id]
  }
  return out
}

function normalizeTemplates(
  raw: Partial<Bitrix24Settings['templates']> | undefined,
): Bitrix24Settings['templates'] {
  const out = { ...DEFAULT_BITRIX24_TEMPLATES }
  if (!raw) return out
  for (const id of BITRIX24_TRIGGER_IDS) {
    const value = raw[id]
    if (typeof value === 'string' && value.trim()) out[id] = value
  }
  return out
}

export function normalizeBitrix24Settings(
  raw: Partial<Bitrix24Settings> | null | undefined,
): Bitrix24Settings {
  if (!raw) return { ...DEFAULT_BITRIX24_SETTINGS, templates: { ...DEFAULT_BITRIX24_TEMPLATES } }
  return {
    enabled: raw.enabled === true,
    triggers: normalizeTriggers(raw.triggers),
    templates: normalizeTemplates(raw.templates),
    progressSkuInterval: clampInt(raw.progressSkuInterval, DEFAULT_BITRIX24_SETTINGS.progressSkuInterval, 1, 500),
    periodicStatusMinutes: clampInt(
      raw.periodicStatusMinutes,
      DEFAULT_BITRIX24_SETTINGS.periodicStatusMinutes,
      5,
      240,
    ),
  }
}

export function loadBitrix24Settings(): Bitrix24Settings {
  try {
    const stored = localStorage.getItem(BITRIX24_SETTINGS_STORAGE_KEY)
    if (!stored) return normalizeBitrix24Settings(null)
    return normalizeBitrix24Settings(JSON.parse(stored) as Partial<Bitrix24Settings>)
  } catch {
    return normalizeBitrix24Settings(null)
  }
}

export function saveBitrix24Settings(settings: Bitrix24Settings): void {
  localStorage.setItem(BITRIX24_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export function triggerIdForQcEvent(event: QcEngineEventName): Bitrix24TriggerId | null {
  const map: Record<string, Bitrix24TriggerId> = {
    onBatchStart: 'batchStart',
    onProgress: 'progress',
    onHalfway: 'halfway',
    onPeriodicStatus: 'periodicStatus',
    onError: 'error',
    onBatchPause: 'batchPause',
    onBatchStop: 'batchStop',
    onBatchComplete: 'batchComplete',
  }
  return map[event] ?? null
}
