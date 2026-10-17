import fs from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { getBatchResults } from './qcBatchStore.mjs'
import { runQcExportPipeline } from './qcExport.mjs'

export function registerQcExportIpc() {
  ipcMain.handle('qc:exportBatch', async (event, request) => {
    const pipeline = await runQcExportPipeline(request, getBatchResults)
    if (!pipeline.ok) {
      return { ok: false, error: pipeline.error }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const filters = [{ name: 'Excel Workbook', extensions: ['xlsx'] }]

    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: 'Save QC export',
      defaultPath: pipeline.fileName,
      filters,
    })

    if (canceled || !filePath) {
      return { ok: false, error: 'Export cancelled.' }
    }

    try {
      await fs.writeFile(filePath, pipeline.content)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not write export file.'
      return { ok: false, error: message }
    }

    return {
      ok: true,
      filePath,
      fileName: pipeline.fileName,
      rowCount: pipeline.rowCount,
      format: pipeline.format,
      scope: pipeline.scope,
    }
  })
}
