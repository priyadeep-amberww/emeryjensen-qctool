import type { CustomExcelExportRequest, CustomExcelExportResponse } from '../types/customExport'
import { downloadBase64File } from '../utils/downloadBinary'

function exportBridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.export : undefined
}

export async function generateCustomExcel(
  request: CustomExcelExportRequest,
): Promise<CustomExcelExportResponse> {
  const bridge = exportBridge()
  if (bridge?.generateCustomExcel) {
    const result = await bridge.generateCustomExcel(request)
    if (result.ok && result.base64 && result.mime) {
      downloadBase64File(result.fileName, result.base64, result.mime)
    }
    return result
  }
  // Lazy-load ExcelJS only for web/dev fallback so the main UI bundle does not depend on it at startup.
  const { generateCustomExcelInProcess } = await import('./customExport/generateCustomExcel')
  return generateCustomExcelInProcess(request)
}
