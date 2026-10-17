import { ipcMain } from 'electron'
import { generateCustomExcelBuffer } from './generateCustomExcel.mjs'

export function registerCustomExportIpc() {
  ipcMain.handle('export:generateCustomExcel', async (_event, request) => {
    const pipeline = await generateCustomExcelBuffer(request)
    if (!pipeline.ok) {
      return { ok: false, error: pipeline.error }
    }

    const base64 = Buffer.from(pipeline.buffer).toString('base64')
    return {
      ok: true,
      fileName: pipeline.fileName,
      rowCount: pipeline.rowCount,
      base64,
      mime: pipeline.mime,
    }
  })
}
