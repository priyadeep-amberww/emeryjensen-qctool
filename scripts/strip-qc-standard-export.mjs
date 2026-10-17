import fs from 'node:fs'

let s = fs.readFileSync('src/utils/qcStandardExport.ts', 'utf8')
s = s.replace(/^import type .*\n/gm, '')
s = s.replace(
  /import \{ DEFAULT_APP_SETTINGS \} from '\.\.\/types\/settings'\n/,
  "import { DEFAULT_QC_THRESHOLDS } from './qcThresholdComparison.mjs'\n",
)
s = s.replace(/from '\.\/qcThresholdComparison'/, "from './qcThresholdComparison.mjs'")
s = s.replace(/, type QcCompareOutcome/g, '')
s = s.replace(/: ExcelJS\.Fill =/g, ' =')
s = s.replace(/: readonly string\[\] =/g, ' =')
s = s.replace(/^type VendorShape = \{[\s\S]*?^\}\n\n/m, '')
s = s.replace(/^type AmazonShape = \{[\s\S]*?^\}\n\n/m, '')
s = s.replace(/\(result: QcResult/g, '(result')
s = s.replace(/: QcExportScope/g, '')
s = s.replace(/: string\[\]/g, '')
s = s.replace(/: string/g, '')
s = s.replace(/: number/g, '')
s = s.replace(/: unknown/g, '')
s = s.replace(/: Record<string, unknown>/g, '')
s = s.replace(/: QcCompareOutcome \| null/g, '')
s = s.replace(/ as ArrayBuffer/g, '')
s = s.replace(/ as \{ value\?: unknown \}/g, '')
s = s.replace(/ as Record<string, unknown>/g, '')
s = s.replace(/ \(raw as \{ source\?: string \}\)/g, '')
s = s.replace(/DEFAULT_APP_SETTINGS\.qcThresholds/g, 'DEFAULT_QC_THRESHOLDS')
s = s.replace(/export async function downloadQcExportXlsx[\s\S]*$/m, '')
s = s.replace(
  /\(worksheet: ExcelJS\.Worksheet, columnCount, rowCount\)/,
  '(worksheet, columnCount, rowCount)',
)
s = s.replace(
  /\): \{ outcome: QcCompareOutcome; yesNo; label \}/,
  ')',
)
s = s.replace(/Promise<ArrayBuffer>/g, '')

fs.writeFileSync('electron/export/qcStandardExport.mjs', s)
console.log('Wrote electron/export/qcStandardExport.mjs')
