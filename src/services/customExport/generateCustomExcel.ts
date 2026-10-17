import ExcelJS from 'exceljs'
import type { CustomExcelExportRequest, CustomExcelExportResponse } from '../../types/customExport'
import {
  buildExportRowValues,
  discoverExportColumns,
} from '../../utils/qcExportColumns'
import { filterQcResultsForExport } from '../../utils/qcExport'

const PASS_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
}
const FAIL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' },
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, columnCount: number, rowCount: number) {
  for (let col = 1; col <= columnCount; col++) {
    let maxLen = 10
    for (let row = 1; row <= rowCount; row++) {
      const cell = worksheet.getCell(row, col)
      const text = cell.value == null ? '' : String(cell.value)
      maxLen = Math.max(maxLen, Math.min(text.length + 2, 60))
    }
    worksheet.getColumn(col).width = maxLen
  }
}

/** Browser / web dev fallback — same workbook layout as the Electron main process. */
export async function generateCustomExcelInProcess(
  request: CustomExcelExportRequest,
): Promise<CustomExcelExportResponse> {
  const { results, filter, columnKeys, includeSummarySheet, summary } = request

  if (results.length === 0) {
    return { ok: false, error: 'No QC results to export.' }
  }
  if (columnKeys.length === 0) {
    return { ok: false, error: 'Select at least one column to export.' }
  }

  const filteredRows = filterQcResultsForExport(results, filter)
  if (filteredRows.length === 0) {
    return { ok: false, error: 'No rows match the current verdict filter.' }
  }

  const catalog = discoverExportColumns(results)
  const headerLabels = columnKeys.map((key) => catalog.find((c) => c.key === key)?.label ?? key)
  const verdictColIndex = columnKeys.indexOf('meta:verdict')

  const workbook = new ExcelJS.Workbook()
  const dataSheet = workbook.addWorksheet('QC Export', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const headerRow = dataSheet.addRow(headerLabels)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
  })

  for (const result of filteredRows) {
    const values = buildExportRowValues(result, columnKeys)
    const row = dataSheet.addRow(values)
    if (verdictColIndex >= 0) {
      const cell = row.getCell(verdictColIndex + 1)
      if (result.verdict === 'PASS') cell.fill = PASS_FILL
      else if (result.verdict === 'FAIL') cell.fill = FAIL_FILL
    }
  }

  autoFitColumns(dataSheet, columnKeys.length, filteredRows.length + 1)

  if (includeSummarySheet && summary) {
    const summarySheet = workbook.addWorksheet('Summary')
    const rows = [
      ['Metric', 'Value'],
      ['Total rows', summary.total],
      ['Pass', summary.pass],
      ['Fail', summary.fail],
      ['Manual review', summary.manual],
      ['Pass %', summary.passPct],
      ['Fail %', summary.failPct],
      ['Time taken', summary.timeTakenLabel],
    ]
    for (const rowValues of rows) {
      summarySheet.addRow(rowValues)
    }
    summarySheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true }
    })
    autoFitColumns(summarySheet, 2, rows.length)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `QC_Custom_${stamp}_${filteredRows.length}rows.xlsx`
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)

  return { ok: true, fileName, rowCount: filteredRows.length }
}
