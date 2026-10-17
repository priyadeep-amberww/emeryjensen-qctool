import type { QcExportRequest, QcExportResponse } from '../types/qcExport'
import { exportQcBatchInProcess } from './qc/qcExportService'

function qcBridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.qc : undefined
}

export async function exportQcBatch(request: QcExportRequest): Promise<QcExportResponse> {
  const bridge = qcBridge()
  if (bridge?.exportBatch) {
    return bridge.exportBatch(request)
  }
  return exportQcBatchInProcess(request)
}
