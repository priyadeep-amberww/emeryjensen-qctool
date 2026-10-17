import ExcelJS from 'exceljs'
import { buildExportRowValues, discoverExportColumns } from './qcExportColumns.mjs'
import { filterQcResultsForExport } from '../qcExport.mjs'

const PASS_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
const FAIL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
const HEADER_FONT = { bold: true }

function autoFitColumns(worksheet, columnCount, rowCount) {
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

function applyVerdictCellStyle(cell, rawVerdict) {
  if (rawVerdict === 'PASS') {
    cell.fill = PASS_FILL
  } else if (rawVerdict === 'FAIL') {
    cell.fill = FAIL_FILL
  }
}

function buildSummaryRows(summary) {
  return [
    ['Metric', 'Value'],
    ['Total rows', summary.total],
    ['Pass', summary.pass],
    ['Fail', summary.fail],
    ['Manual review', summary.manual],
    ['Pass %', summary.passPct],
    ['Fail %', summary.failPct],
    ['Time taken', summary.timeTakenLabel],
  ]
}

/**
 * @param {object} request
 * @param {import('../qcExport.mjs').QcResult[]} request.results
 */
export async function generateCustomExcelBuffer(request) {
  const results = Array.isArray(request?.results) ? request.results : []
  const filter = request?.filter ?? 'all'
  const columnKeys = Array.isArray(request?.columnKeys) ? request.columnKeys : []
  const includeSummarySheet = Boolean(request?.includeSummarySheet)
  const summary = request?.summary ?? null

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
  const headerLabels = columnKeys.map((key) => {
    const def = catalog.find((c) => c.key === key)
    return def?.label ?? key
  })

  const verdictColIndex = columnKeys.indexOf('meta:verdict')

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'QC Tool'
  workbook.created = new Date()

  const dataSheet = workbook.addWorksheet('QC Export', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const headerRow = dataSheet.addRow(headerLabels)
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT
  })

  for (const result of filteredRows) {
    const values = buildExportRowValues(result, columnKeys)
    const row = dataSheet.addRow(values)
    if (verdictColIndex >= 0) {
      const cell = row.getCell(verdictColIndex + 1)
      applyVerdictCellStyle(cell, result.verdict)
    }
  }

  autoFitColumns(dataSheet, columnKeys.length, filteredRows.length + 1)

  if (includeSummarySheet && summary) {
    const summarySheet = workbook.addWorksheet('Summary')
    for (const rowValues of buildSummaryRows(summary)) {
      summarySheet.addRow(rowValues)
    }
    summarySheet.getRow(1).eachCell((cell) => {
      cell.font = HEADER_FONT
    })
    autoFitColumns(summarySheet, 2, buildSummaryRows(summary).length)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `QC_Custom_${stamp}_${filteredRows.length}rows.xlsx`

  return {
    ok: true,
    buffer,
    fileName,
    rowCount: filteredRows.length,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
