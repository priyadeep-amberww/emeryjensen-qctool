import type { Bitrix24Settings } from '../../types/bitrix24'
import { triggerIdForQcEvent } from '../../utils/bitrix24SettingsStorage'
import { sendBitrix24Message } from './bitrix24Api'
import { renderBitrix24Template } from './templateRenderer'
import type { QcEngineEventPayload } from '../qc/qcEngineEventBus'

export async function dispatchBitrix24Notification(
  settings: Bitrix24Settings,
  payload: QcEngineEventPayload,
): Promise<{ ok: boolean; error?: string }> {
  if (!settings.enabled) {
    return { ok: false, error: 'Bitrix24 notifications are disabled.' }
  }

  const triggerId = triggerIdForQcEvent(payload.event)
  if (!triggerId || !settings.triggers[triggerId]) {
    return { ok: false, error: 'Trigger disabled.' }
  }

  const template = settings.templates[triggerId]
  const message = renderBitrix24Template(template, payload)
  const result = await sendBitrix24Message({ message })
  if (!result.ok) {
    return { ok: false, error: result.error }
  }
  return { ok: true }
}
