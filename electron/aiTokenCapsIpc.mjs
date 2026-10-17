import { ipcMain } from 'electron'
import { loadAiTokenCaps, saveAiTokenCaps } from './aiTokenCaps.mjs'

export function registerAiTokenCapsIpc() {
  ipcMain.handle('aiCaps:get', async () => {
    const caps = await loadAiTokenCaps()
    return { ok: true, caps }
  })

  ipcMain.handle('aiCaps:save', async (_event, payload) => {
    try {
      const caps = await saveAiTokenCaps(payload)
      return { ok: true, caps }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save token caps.'
      return { ok: false, error: message }
    }
  })
}
