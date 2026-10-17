import ExcelJS from 'exceljs'
import type { QcResult } from '../types/qc'
import type { QcExportScope } from '../types/qcExport'
import { DEFAULT_APP_SETTINGS } from '../types/settings'
import {
  comparisonOutcomeForKey,
  imageSimilarityPercent,
  type QcCompareOutcome,
} from './qcThresholdComparison'
import { extractAmazonCoreFields, extractVendorCoreFields } from './qcCoreFieldMap'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const PACK_ATTR_KEY_RE =
  /pack|quantity|items|item_count|unit_count|multipack|case|volume|size|weight|count|om\b|order_multiple/i

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

export const STANDARD_QC_EXPORT_HEADERS: readonly string[] = [
  'ASIN',
  'VENDOR MODEL',
  'VERDICT',
  'Pack Size Vendor',
  'Pack Size Amazon',
  'Pack Size Result',
  'Brand Vendor',
  'Brand Amazon',
  'Brand Result',
  'Title Vendor',
  'Title Amazon',
  'Title Result',
  'Title Comparison',
  'Model Number Vendor',
  'Model Number Amazon',
  'Model Number Result',
  'UPC Vendor',
  'UPC Amazon',
  'UPC Result',
  'Image Comparison Percentage',
  'Image Result',
  'Pack Size Attributes Vendor',
  'Pack Size Attributes Amazon',
  'Specifications Amazon',
  'Specifications Vendor',
  'Specifications Result',
  'Description Vendor',
  'Description Amazon',
  'Description Result',
  'Vendor SKU',
  'EJD SKU',
  'Capture Status',
  'Price Vendor',
  'Price Amazon',
  'Vendor URL',
  'Amazon URL',
  'Image URL Vendor',
  'Image URL Amazon',
  'QC Notes',
  'Input Tokens',
  'Output Tokens',
  'Amazon SP-API Pack Key Values',
  'Amazon Engine Outer Pack',
  'Amazon Engine Pack Confidence',
  'Amazon Engine Methods',
  'Amazon Engine Evidence',
  'Amazon Engine Inner Count',
  'Amazon Engine Inner Unit',
  'Amazon Engine Inner Evidence',
  'Amazon Engine Inner Source',
  'Amazon Engine Signals',
  'Amazon Engine Warnings',
  'Amazon Pack Engine Version',
]

type VendorShape = {
  title: string
  brand: string
  modelNumber: string
  packSize: string
  upc: string
  description: string
  imageUrl: string
  pageUrl: string
  packAttrs: string
  specifications: string
  price: string
  ejdSku: string
}

type AmazonShape = {
  title: string
  brand: string
  modelNumber: string
  packSize: string
  upc: string
  description: string
  imageUrl: string
  listingUrl: string
  packAttrs: string
  specifications: string
  price: string
  asin: string
}

function identityValue(result: QcResult, ...keys: string[]): string {
  for (const key of keys) {
    const field = result.identity.find((f) => f.key === key)
    if (field?.value?.trim() && field.value.trim() !== '—') return field.value.trim()
  }
  return ''
}

function comparisonPair(
  result: QcResult,
  key: string,
): { source: string; target: string; field?: QcResult['comparisons'][number] } {
  const field = result.comparisons.find((c) => c.key === key)
  return {
    source: field?.sourceValue?.trim() ?? '',
    target: field?.targetValue?.trim() ?? '',
    field,
  }
}

function pickString(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed
}

function pickAmazonAttribute(attributes: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const node = attributes[key]
    if (!node) continue
    if (Array.isArray(node) && node[0] != null && typeof node[0] === 'object') {
      const v = (node[0] as { value?: unknown }).value
      if (v != null && String(v).trim()) return String(v).trim()
    }
    if (typeof node === 'string' && node.trim()) return node.trim()
  }
  return ''
}

function flattenAmazonAttributes(attributes: Record<string, unknown>): string[] {
  const lines: string[] = []
  for (const [key, node] of Object.entries(attributes)) {
    if (node == null) continue
    if (Array.isArray(node)) {
      const values = node
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'value' in entry) {
            return String((entry as { value?: unknown }).value ?? '').trim()
          }
          return String(entry ?? '').trim()
        })
        .filter(Boolean)
      if (values.length) lines.push(`${key}: ${values.join('; ')}`)
      continue
    }
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      lines.push(`${key}: ${String(node)}`)
    }
  }
  return lines.sort((a, b) => a.localeCompare(b))
}

function packLinesFromAmazonAttributes(attributes: Record<string, unknown>): string {
  const lines = flattenAmazonAttributes(attributes).filter((line) => PACK_ATTR_KEY_RE.test(line))
  return lines.join(' | ')
}

function isVendorWebsiteExtract(raw: unknown): raw is {
  source: 'vendor_website'
  title?: string
  brand?: string
  modelNumber?: string
  packSize?: string
  upc?: string
  imageUrl?: string
  pageUrl?: string
  rawAttributes?: Record<string, unknown>
} {
  return Boolean(raw && typeof raw === 'object' && (raw as { source?: string }).source === 'vendor_website')
}

function isEjdVendorRecord(raw: unknown): raw is {
  identity?: {
    ejd_sku?: string
    upc?: string
    mfg_part_number?: string
    title?: string
    brand?: string
    brand_name?: string
    vendor?: { name?: string }
  }
  commercials?: {
    order_multiple?: number
    wholesale_cost?: number
    store_retail_msrp?: number
    case_cost?: number
  }
  inventory?: Record<string, unknown>
  compliance?: Record<string, unknown>
  logistics?: Record<string, unknown>
  media?: { primary_image_url?: string }
} {
  return Boolean(raw && typeof raw === 'object' && (raw as { identity?: { ejd_sku?: string } }).identity?.ejd_sku)
}

function parseAmazonCatalog(raw: unknown, fallbackAsin: string): AmazonShape {
  const empty: AmazonShape = {
    asin: fallbackAsin,
    title: '',
    brand: '',
    modelNumber: '',
    packSize: '',
    upc: '',
    description: '',
    imageUrl: '',
    listingUrl: fallbackAsin ? `https://www.amazon.com/dp/${fallbackAsin}` : '',
    packAttrs: '',
    specifications: '',
    price: '',
  }

  if (isVendorWebsiteExtract(raw)) return empty

  if (raw && typeof raw === 'object' && (raw as { source?: string }).source === 'amazon') {
    const amz = raw as {
      asin?: string
      title?: string
      brand?: string
    brand_name?: string
      modelNumber?: string
      packSize?: string
      upc?: string
      imageUrl?: string
      listingUrl?: string
      rawAttributes?: Record<string, unknown>
    }
    const attrs = amz.rawAttributes ?? {}
    const spApi =
      attrs.spApi && typeof attrs.spApi === 'object'
        ? (attrs.spApi as Record<string, unknown>)
        : null
    const catalogAttrs =
      spApi?.attributes && typeof spApi.attributes === 'object'
        ? (spApi.attributes as Record<string, unknown>)
        : {}
    const asin = pickString(amz.asin) || fallbackAsin
    return {
      asin,
      title: pickString(amz.title),
      brand: pickString(amz.brand),
      modelNumber: pickString(amz.modelNumber),
      packSize: pickString(amz.packSize),
      upc: pickString(amz.upc),
      description:
        pickAmazonAttribute(catalogAttrs, ['product_description', 'bullet_point', 'item_name']) ||
        pickString(amz.title),
      imageUrl: pickString(amz.imageUrl),
      listingUrl: pickString(amz.listingUrl) || (asin ? `https://www.amazon.com/dp/${asin}` : ''),
      packAttrs: packLinesFromAmazonAttributes(catalogAttrs),
      specifications: flattenAmazonAttributes(catalogAttrs).join(' | '),
      price: attrs.priceUsd != null ? String(attrs.priceUsd) : '',
    }
  }

  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = (summaries[0] ?? {}) as Record<string, unknown>
  const attributes =
    root.attributes && typeof root.attributes === 'object'
      ? (root.attributes as Record<string, unknown>)
      : {}

  const asin = fallbackAsin || pickString(summary.asin as string)
  const core = extractAmazonCoreFields(raw)

  return {
    asin,
    title: core.title,
    brand: core.brand,
    modelNumber: core.model,
    packSize: core.packAmazon,
    upc: core.upc,
    description:
      pickAmazonAttribute(attributes, ['product_description', 'bullet_point']) ||
      pickString(summary.itemName as string),
    imageUrl: core.imageAmazon,
    listingUrl: asin ? `https://www.amazon.com/dp/${asin}` : '',
    packAttrs: packLinesFromAmazonAttributes(attributes),
    specifications: flattenAmazonAttributes(attributes).join(' | '),
    price: pickAmazonAttribute(attributes, ['list_price', 'buying_price', 'our_price']),
  }
}

function parseVendorExtract(raw: unknown): VendorShape {
  const empty: VendorShape = {
    title: '',
    brand: '',
    modelNumber: '',
    packSize: '',
    upc: '',
    description: '',
    imageUrl: '',
    pageUrl: '',
    packAttrs: '',
    specifications: '',
    price: '',
    ejdSku: '',
  }
  if (!raw || typeof raw !== 'object') return empty

  if (isVendorWebsiteExtract(raw)) {
    const attrs = raw.rawAttributes ?? {}
    const packParts: string[] = []
    if (raw.packSize) packParts.push(`pack_size: ${raw.packSize}`)
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null) continue
      if (PACK_ATTR_KEY_RE.test(key)) packParts.push(`${key}: ${String(value)}`)
    }
    const specLines = Object.entries(attrs)
      .filter(([key]) => !PACK_ATTR_KEY_RE.test(key))
      .map(([key, value]) => `${key}: ${String(value)}`)
    return {
      title: pickString(raw.title),
      brand: pickString(raw.brand),
      modelNumber: pickString(raw.modelNumber),
      packSize: pickString(raw.packSize),
      upc: pickString(raw.upc),
      description: pickString(raw.title),
      imageUrl: pickString(raw.imageUrl),
      pageUrl: pickString(raw.pageUrl),
      packAttrs: packParts.join(' | '),
      specifications: specLines.join(' | '),
      price: attrs.priceUsd != null ? String(attrs.priceUsd) : '',
      ejdSku: '',
    }
  }

  if (isEjdVendorRecord(raw)) {
    const id = raw.identity ?? {}
    const commercials = raw.commercials ?? {}
    const logistics =
      raw.logistics && typeof raw.logistics === 'object'
        ? (raw.logistics as Record<string, unknown>)
        : {}
    const om = commercials.order_multiple ?? 1
    const packParts = [`order_multiple: ${om}`]
    if (commercials.wholesale_cost != null) {
      packParts.push(`wholesale_cost: ${commercials.wholesale_cost}`)
    }
    if (commercials.case_cost != null) {
      packParts.push(`case_cost: ${commercials.case_cost}`)
    }
    const specChunks: string[] = []
    if (id.mfg_part_number) specChunks.push(`mfg_part_number: ${id.mfg_part_number}`)
    if (id.vendor?.name) specChunks.push(`vendor_name: ${id.vendor.name}`)
    for (const [key, value] of Object.entries(logistics)) {
      if (value != null && value !== '') specChunks.push(`${key}: ${String(value)}`)
    }
    if (raw.inventory) {
      for (const [key, value] of Object.entries(raw.inventory)) {
        if (value != null && value !== '') specChunks.push(`${key}: ${String(value)}`)
      }
    }
    if (raw.compliance) {
      for (const [key, value] of Object.entries(raw.compliance)) {
        if (value != null && value !== '') specChunks.push(`${key}: ${String(value)}`)
      }
    }
    const core = extractVendorCoreFields(raw)
    return {
      title: core.title,
      brand: core.brand,
      modelNumber: core.model,
      packSize: core.packVendor,
      upc: core.upc,
      description: pickString(id.title),
      imageUrl: core.imageVendor,
      pageUrl: '',
      packAttrs: packParts.join(' | '),
      specifications: specChunks.join(' | '),
      price:
        commercials.wholesale_cost != null ? String(commercials.wholesale_cost) : '',
      ejdSku: pickString(id.ejd_sku),
    }
  }

  return empty
}

function outcomeToYesNo(outcome: QcCompareOutcome | null): string {
  if (outcome === 'MATCH') return 'YES'
  if (outcome === 'MISMATCH' || outcome === 'REVIEW') return 'NO'
  return ''
}

function outcomeLabel(outcome: QcCompareOutcome | null): string {
  if (!outcome) return ''
  if (outcome === 'MATCH') return 'MATCH'
  if (outcome === 'MISMATCH') return 'MISMATCH'
  return 'REVIEW'
}

function compareField(
  key: string,
  source: string,
  target: string,
  field?: QcResult['comparisons'][number],
): { outcome: QcCompareOutcome; yesNo: string; label: string } {
  const thresholds = DEFAULT_APP_SETTINGS
  const outcome = comparisonOutcomeForKey(key, source, target, thresholds, undefined, field)
  return { outcome, yesNo: outcomeToYesNo(outcome), label: outcomeLabel(outcome) }
}

function spApiPackPairsFromCatalog(raw: unknown): string {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = (summaries[0] ?? {}) as Record<string, unknown>
  const attributes =
    root.attributes && typeof root.attributes === 'object'
      ? (root.attributes as Record<string, unknown>)
      : {}
  const keys = ['size', 'number_of_items', 'item_package_quantity', 'unit_count', 'package_level']
  const lines: string[] = []
  if (summary.packageQuantity != null) lines.push(`packageQuantity: ${summary.packageQuantity}`)
  for (const key of keys) {
    const node = attributes[key]
    const value = Array.isArray(node)
      ? (node[0] as { value?: unknown } | undefined)?.value
      : node
    if (value != null && String(value).trim()) lines.push(`${key}: ${value}`)
  }
  return lines.join(' | ')
}

function amazonPackExportCells(result: QcResult): string[] {
  const report = result.amazonPackReport
  if (!report) {
    return [
      spApiPackPairsFromCatalog(result.targetRawExtract),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]
  }
  const warnings = Array.isArray(report.warnings) ? report.warnings.join(' | ') : String(report.warnings ?? '')
  return [
    report.spApiPairs,
    report.outerPack,
    String(report.confidence ?? ''),
    report.methods,
    report.evidence,
    report.innerCount,
    report.innerUnitType,
    report.innerEvidence,
    report.innerSource,
    report.signals,
    warnings,
    report.engineVersion,
  ]
}

function coalesce(...values: (string | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim()
    if (t && t !== '—') return t
  }
  return ''
}

export function formatEmryQcExportFileName(scope: QcExportScope, rowCount: number, at = new Date()): string {
  const day = String(at.getDate()).padStart(2, '0')
  const month = MONTHS[at.getMonth()] ?? 'JAN'
  const year = String(at.getFullYear()).slice(-2)
  const scopeLabel = scope === 'partial' ? 'Partial' : 'Full'
  return `EMRY-QC-${scopeLabel}-${rowCount}SKU-${day}${month}${year}.xlsx`
}

export function buildStandardQcExportRow(result: QcResult): string[] {
  const asin = coalesce(identityValue(result, 'listing_id', 'asin'), parseAmazonCatalog(result.targetRawExtract, '').asin)
  const vendorModel = coalesce(identityValue(result, 'sku', 'part_sku', 'vendor_sku'))
  const inputUpc = identityValue(result, 'upc')

  const vendor = parseVendorExtract(result.sourceRawExtract)
  const amazon = parseAmazonCatalog(result.targetRawExtract, asin)

  const titleCmp = comparisonPair(result, 'title')
  const brandCmp = comparisonPair(result, 'brand')
  const modelCmp = comparisonPair(result, 'model')
  const packCmp = comparisonPair(result, 'pack')
  const upcCmp = comparisonPair(result, 'upc')
  const imageCmp = comparisonPair(result, 'image')
  const descCmp = comparisonPair(result, 'description')
  const specCmp = comparisonPair(result, 'specifications')

  const titleVendor = coalesce(titleCmp.source, vendor.title)
  const titleAmazon = coalesce(titleCmp.target, amazon.title)
  const brandVendor = coalesce(brandCmp.source, vendor.brand, identityValue(result, 'brand'))
  const brandAmazon = coalesce(brandCmp.target, amazon.brand)
  const modelVendor = coalesce(modelCmp.source, vendor.modelNumber)
  const modelAmazon = coalesce(modelCmp.target, amazon.modelNumber)
  const packVendor = coalesce(packCmp.source, vendor.packSize)
  const packAmazon = coalesce(packCmp.target, amazon.packSize)
  const upcVendor = coalesce(inputUpc, upcCmp.source, vendor.upc)
  const upcAmazon = coalesce(upcCmp.target, amazon.upc)
  const imageVendor = coalesce(imageCmp.source, result.sourceImageUrl, vendor.imageUrl)
  const imageAmazon = coalesce(imageCmp.target, result.targetImageUrl, amazon.imageUrl)
  const descVendor = coalesce(descCmp.source, vendor.description)
  const descAmazon = coalesce(descCmp.target, amazon.description)

  const titleCompare = compareField('title', titleVendor, titleAmazon, titleCmp.field)
  const brandCompare = compareField('brand', brandVendor, brandAmazon, brandCmp.field)
  const modelCompare = compareField('model', modelVendor, modelAmazon, modelCmp.field)
  const packCompare = compareField('pack', packVendor, packAmazon, packCmp.field)
  const upcCompare = compareField('upc', upcVendor, upcAmazon, upcCmp.field)
  const descCompare = compareField('description', descVendor, descAmazon, descCmp.field)

  const imagePct =
    imageCmp.field?.scorePercent != null
      ? String(imageCmp.field.scorePercent)
      : imageVendor && imageAmazon
        ? String(imageSimilarityPercent(imageVendor, imageAmazon))
        : ''
  const imageOutcome = comparisonOutcomeForKey(
    'image',
    imageVendor,
    imageAmazon,
    DEFAULT_APP_SETTINGS,
    undefined,
    imageCmp.field,
  )

  const vendorSpecs = coalesce(specCmp.source, vendor.specifications)
  const amazonSpecs = coalesce(specCmp.target, amazon.specifications)
  const specsCompare = compareField('specifications', vendorSpecs, amazonSpecs, specCmp.field)

  const qcNotes = result.comparisons
    .filter(
      (c) =>
        ![
          'title',
          'brand',
          'model',
          'pack',
          'upc',
          'image',
          'description',
          'specifications',
          'price',
        ].includes(c.key),
    )
    .map((c) => `${c.label}: ${c.sourceValue} → ${c.targetValue}`)
    .join(' | ')

  const imageYesNo = outcomeToYesNo(imageOutcome)
  const coreVerdict = [
    packCompare.yesNo,
    brandCompare.yesNo,
    titleCompare.yesNo,
    modelCompare.yesNo,
    upcCompare.yesNo,
    imageYesNo,
  ].every((value) => value === 'YES')
    ? 'PASS'
    : 'FAIL'

  return [
    asin,
    vendorModel,
    coreVerdict,
    packVendor,
    packAmazon,
    packCompare.yesNo,
    brandVendor,
    brandAmazon,
    brandCompare.yesNo,
    titleVendor,
    titleAmazon,
    titleCompare.label,
    titleCompare.yesNo,
    modelVendor,
    modelAmazon,
    modelCompare.yesNo,
    upcVendor,
    upcAmazon,
    upcCompare.yesNo,
    imagePct,
    imageYesNo,
    coalesce(vendor.packAttrs, packVendor ? `pack_size: ${packVendor}` : ''),
    coalesce(amazon.packAttrs, packAmazon ? `pack_size: ${packAmazon}` : ''),
    amazonSpecs,
    vendorSpecs,
    specsCompare.yesNo,
    descVendor,
    descAmazon,
    descCompare.yesNo,
    vendorModel,
    coalesce(vendor.ejdSku, identityValue(result, 'ejd_sku')),
    result.captureStatus ? result.captureStatus.replace(/_/g, ' ') : '',
    coalesce(vendor.price, comparisonPair(result, 'price').source),
    coalesce(amazon.price, comparisonPair(result, 'price').target),
    coalesce(vendor.pageUrl),
    coalesce(amazon.listingUrl, asin ? `https://www.amazon.com/dp/${asin}` : ''),
    imageVendor,
    imageAmazon,
    qcNotes,
    String(result.inputTokens ?? 0),
    String(result.outputTokens ?? 0),
    ...amazonPackExportCells(result),
  ]
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, columnCount: number, rowCount: number) {
  for (let col = 1; col <= columnCount; col++) {
    let maxLen = 12
    for (let row = 1; row <= rowCount; row++) {
      const cell = worksheet.getCell(row, col)
      const text = cell.value == null ? '' : String(cell.value)
      maxLen = Math.max(maxLen, Math.min(text.length + 2, 72))
    }
    worksheet.getColumn(col).width = maxLen
  }
}

export async function buildQcExportXlsxBuffer(results: QcResult[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('QC Export', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const headerRow = sheet.addRow([...STANDARD_QC_EXPORT_HEADERS])
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
  })

  const verdictColIndex = STANDARD_QC_EXPORT_HEADERS.indexOf('VERDICT') + 1

  for (const result of results) {
    const values = buildStandardQcExportRow(result)
    const row = sheet.addRow(values)
    const verdictCell = row.getCell(verdictColIndex)
    if (result.verdict === 'PASS') verdictCell.fill = PASS_FILL
    else if (result.verdict === 'FAIL') verdictCell.fill = FAIL_FILL
  }

  autoFitColumns(sheet, STANDARD_QC_EXPORT_HEADERS.length, results.length + 1)
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

export async function downloadQcExportXlsx(fileName: string, results: QcResult[]) {
  const buffer = await buildQcExportXlsxBuffer(results)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
