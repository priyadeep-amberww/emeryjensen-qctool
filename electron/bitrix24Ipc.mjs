import { ipcMain } from 'electron'
import { getDecryptedValues } from './credentialsStore.mjs'
import {
  resolveBitrixDialogId,
  sendBitrix24Message,
  testBitrix24Connection,
} from './bitrix24/bitrix24Api.mjs'

const BITRIX_KEYS = [
  'BITRIX24_WEBHOOK_URL',
  'BITRIX24_API_TOKEN',
  'BITRIX24_GROUP_CHAT_ID',
  'BITRIX24_CHANNEL_PREFERENCE',
]

async function loadBitrixCredentials() {
  const values = await getDecryptedValues(BITRIX_KEYS)
  return {
    webhookUrl: values.BITRIX24_WEBHOOK_URL?.trim() ?? '',
    apiToken: values.BITRIX24_API_TOKEN?.trim() ?? '',
    groupChatId: values.BITRIX24_GROUP_CHAT_ID?.trim() ?? '',
    channelPreference: values.BITRIX24_CHANNEL_PREFERENCE?.trim() ?? 'group_chat',
  }
}

export function registerBitrix24Ipc() {
  ipcMain.handle('bitrix24:testConnection', async () => {
    try {
      const creds = await loadBitrixCredentials()
      const result = await testBitrix24Connection(creds)
      if (!result.ok) {
        return { ok: false, error: result.error ?? 'Connection test failed.' }
      }
      return { ok: true, message: result.message ?? 'Connection verified.' }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed.'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('bitrix24:sendMessage', async (_event, payload) => {
    const message = String(payload?.message ?? '').trim()
    const overrideDialogId = payload?.dialogId ? String(payload.dialogId).trim() : ''
    if (!message) {
      return { ok: false, error: 'Message is required.' }
    }

    try {
      const creds = await loadBitrixCredentials()
      const dialogId =
        overrideDialogId ||
        resolveBitrixDialogId({
          channelPreference: creds.channelPreference,
          groupChatId: creds.groupChatId,
        })
      const result = await sendBitrix24Message({
        webhookUrl: creds.webhookUrl,
        apiToken: creds.apiToken,
        dialogId,
        message,
      })
      if (!result.ok) {
        return { ok: false, error: result.error ?? 'Failed to send message.' }
      }
      return { ok: true, messageId: result.messageId }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message.'
      return { ok: false, error: msg }
    }
  })
}
