import ExcelJS from 'exceljs'
import { DEFAULT_QC_THRESHOLDS } from './qcThresholdComparison.mjs'
import {
  comparisonOutcomeForKey,
  exactCompareOutcome,
  imageSimilarityPercent,
} from './qcThresholdComparison.mjs'
import { extractAmazonCoreFields, extractVendorCoreFields } from '../qc/qcCoreFieldMap.mjs'
import { flattenFilteredAmazonAttributes, filteredBulletPoints } from '../qc/amazonAttributeFilter.mjs'
import { resolveAmazonRetailPack } from '../qc/packSizeResolve.mjs'
import { AMAZON_PACK_EXPORT_HEADERS, amazonPackExportCells } from '../qc/spApiPackAdapter.mjs'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const PACK_ATTR_KEY_RE =
  /pack|quantity|items|item_count|unit_count|multipack|case|volume|size|weight|count|om\b|order_multiple/i

const PASS_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFC6EFCE' },
}
const FAIL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' },
}

export const STANDARD_QC_EXPORT_HEADERS = [
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
  ...AMAZON_PACK_EXPORT_HEADERS,
]

function identityValue(result, ...keys) {
  for (const key of keys) {
    const field = result.identity.find((f) => f.key === key)
    if (field?.value?.trim() && field.value.trim() !== '—') return field.value.trim()
  }
  return ''
}

function comparisonPair(result, key) {
  const field = result.comparisons.find((c) => c.key === key)
  return {
    source: field?.sourceValue?.trim() ?? '',
    target: field?.targetValue?.trim() ?? '',
    field,
  }
}

function pickString(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed
}

function pickAmazonAttribute(attributes, keys) {
  for (const key of keys) {
    const node = attributes[key]
    if (!node) continue
    if (Array.isArray(node) && node[0] != null && typeof node[0] === 'object') {
      const v = node[0].value
      if (v != null && String(v).trim()) return String(v).trim()
    }
    if (typeof node === 'string' && node.trim()) return node.trim()
  }
  return ''
}

function packLinesFromAmazonAttributes(attributes) {
  const lines = flattenFilteredAmazonAttributes(attributes).filter((line) =>
    PACK_ATTR_KEY_RE.test(line),
  )
  return lines.join(' | ')
}

function isVendorWebsiteExtract(raw) {
  return Boolean(raw && typeof raw === 'object' && raw.source === 'vendor_website')
}

function isEjdVendorRecord(raw) {
  return Boolean(raw && typeof raw === 'object' && raw.identity?.ejd_sku)
}

function parseAmazonCatalog(raw, fallbackAsin) {
  const empty = {
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

  if (raw && typeof raw === 'object' && raw.source === 'amazon') {
    const amz = raw
    const attrs = amz.rawAttributes ?? {}
    const spApi =
      attrs.spApi && typeof attrs.spApi === 'object'
        ? (attrs.spApi)
        : null
    const catalogAttrs =
      spApi?.attributes && typeof spApi.attributes === 'object'
        ? (spApi.attributes)
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
      specifications: flattenFilteredAmazonAttributes(catalogAttrs).join(' | '),
      price: attrs.priceUsd != null ? String(attrs.priceUsd) : '',
    }
  }

  const root = raw && typeof raw === 'object' ? (raw) : {}
  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = (summaries[0] ?? {})
  const attributes =
    root.attributes && typeof root.attributes === 'object'
      ? (root.attributes)
      : {}

  const asin = fallbackAsin || pickString(summary.asin)
  const core = extractAmazonCoreFields(raw)
  const retailPack = resolveAmazonRetailPack(raw)

  return {
    asin,
    title: core.title,
    brand: core.brand,
    modelNumber: core.model,
    packSize: String(retailPack.packSize),
    upc: core.upc,
    description:
      filteredBulletPoints(attributes).join(' | ') ||
      pickAmazonAttribute(attributes, ['product_description']) ||
      pickString(summary.itemName),
    imageUrl: core.imageAmazon,
    listingUrl: asin ? `https://www.amazon.com/dp/${asin}` : '',
    packAttrs: packLinesFromAmazonAttributes(attributes),
    specifications: flattenFilteredAmazonAttributes(attributes).join(' | '),
    price: pickAmazonAttribute(attributes, ['list_price', 'buying_price', 'our_price']),
  }
}

function parseVendorExtract(raw) {
  const empty = {
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
    const packParts = []
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
    const logistics = raw.logistics && typeof raw.logistics === 'object' ? raw.logistics : {}
    const om = commercials.order_multiple ?? 1
    const packParts = [`order_multiple: ${om}`]
    if (commercials.wholesale_cost != null) {
      packParts.push(`wholesale_cost: ${commercials.wholesale_cost}`)
    }
    if (commercials.case_cost != null) {
      packParts.push(`case_cost: ${commercials.case_cost}`)
    }
    const specChunks = []
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

function outcomeToYesNo(outcome) {
  if (outcome === 'MATCH') return 'YES'
  if (outcome === 'REVIEW') return 'REVIEW'
  if (outcome === 'MISMATCH') return 'NO'
  return ''
}

function outcomeLabel(outcome) {
  if (!outcome) return ''
  if (outcome === 'MATCH') return 'MATCH'
  if (outcome === 'MISMATCH') return 'MISMATCH'
  return 'REVIEW'
}

function compareField(key, source, target, field) {
  const thresholds = DEFAULT_QC_THRESHOLDS
  const outcome = comparisonOutcomeForKey(key, source, target, thresholds, undefined, field)
  return { outcome, yesNo: outcomeToYesNo(outcome), label: outcomeLabel(outcome) }
}

function coalesce(...values) {
  for (const v of values) {
    const t = v?.trim()
    if (t && t !== '—') return t
  }
  return ''
}

export function formatEmryQcExportFileName(scope, rowCount, at = new Date()) {
  const day = String(at.getDate()).padStart(2, '0')
  const month = MONTHS[at.getMonth()] ?? 'JAN'
  const year = String(at.getFullYear()).slice(-2)
  const scopeLabel = scope === 'partial' ? 'Partial' : 'Full'
  return `EMRY-QC-${scopeLabel}-${rowCount}SKU-${day}${month}${year}.xlsx`
}

export function buildStandardQcExportRow(result) {
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
    DEFAULT_QC_THRESHOLDS,
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
    ...amazonPackExportCells(result.targetRawExtract),
  ]
}

function autoFitColumns(worksheet, columnCount, rowCount) {
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

export async function buildQcExportXlsxBuffer(results) {
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
  return buffer
}

