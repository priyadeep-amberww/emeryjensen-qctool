import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { resolveAmazonRetailPack } from './packSizeResolve.mjs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packEngine = require(path.join(__dirname, '../../ResearchData/universalAmazonPackSizeEngine.js'))

function pickAttrValue(node) {
  if (node == null) return null
  if (Array.isArray(node)) {
    for (const entry of node) {
      if (entry && typeof entry === 'object' && 'value' in entry) {
        const v = entry.value
        if (v != null && String(v).trim()) return v
      }
    }
    return null
  }
  if (typeof node === 'object' && 'value' in node) return node.value
  return node
}

function unwrapAttributes(attributes) {
  const specs = {}
  if (!attributes || typeof attributes !== 'object') return specs
  for (const [key, node] of Object.entries(attributes)) {
    const v = pickAttrValue(node)
    if (v != null && v !== '') specs[key] = v
  }
  return specs
}

function joinBulletPoints(attributes) {
  const bullets = attributes?.bullet_point
  if (!Array.isArray(bullets)) return ''
  const lines = []
  for (const entry of bullets) {
    const v = pickAttrValue(entry)
    if (v != null && String(v).trim()) lines.push(String(v).trim())
  }
  return lines.join(' ')
}

/**
 * Map SP-API catalog JSON to universal pack engine input.
 * @param {unknown} catalogJson
 */
export function catalogJsonToPackEngineInput(catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}
  const summaries = Array.isArray(root.summaries) ? root.summaries : []
  const summary = summaries[0] && typeof summaries[0] === 'object' ? summaries[0] : {}
  const attributes =
    root.attributes && typeof root.attributes === 'object' ? root.attributes : {}
  const specs = unwrapAttributes(attributes)

  return {
    success: true,
    title: summary.itemName ?? null,
    size: pickAttrValue(attributes.size) ?? specs.size ?? null,
    packageQuantity: summary.packageQuantity ?? specs.item_package_quantity ?? null,
    numberOfItems: specs.number_of_items ?? pickAttrValue(attributes.number_of_items) ?? null,
    unitCount: specs.unit_count ?? pickAttrValue(attributes.unit_count) ?? null,
    listingText: joinBulletPoints(attributes),
    specs,
    productTypes: Array.isArray(root.productTypes) ? root.productTypes : [],
    asin: summary.asin ?? root.asin ?? null,
  }
}

const SP_API_PACK_KEYS = [
  'size',
  'number_of_items',
  'item_package_quantity',
  'unit_count',
  'item_package_quantity_type',
  'package_level',
]

function formatSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return ''
  return signals
    .map((s) => `${s.source}=${s.value} (${s.confidence}) ${s.evidence ?? ''}`.trim())
    .join(' | ')
}

/**
 * Full pack report for Excel: SP-API pairs plus engine outer/inner/signals.
 */
export function buildAmazonPackReport(catalogJson) {
  const input = catalogJsonToPackEngineInput(catalogJson)
  const analyzed = packEngine.analyzeAmazonListing(input)
  const extracted = analyzed.amazon ?? {}
  const specs = input.specs ?? {}
  const pairs = []
  if (input.packageQuantity != null) pairs.push(`packageQuantity: ${input.packageQuantity}`)
  if (input.numberOfItems != null) pairs.push(`numberOfItems: ${input.numberOfItems}`)
  if (input.unitCount != null) pairs.push(`unitCount: ${input.unitCount}`)
  if (input.size != null) pairs.push(`size: ${input.size}`)
  for (const key of SP_API_PACK_KEYS) {
    if (specs[key] != null && !pairs.some((line) => line.startsWith(`${key}:`))) {
      pairs.push(`${key}: ${specs[key]}`)
    }
  }
  return {
    packSize: extracted.packSize ?? analyzed.summary?.packSize ?? 1,
    confidence: extracted.confidence ?? analyzed.summary?.confidence ?? 0,
    warnings: extracted.warnings ?? analyzed.summary?.warnings ?? [],
    spApiPairs: pairs.join(' | '),
    outerPack: String(extracted.packSize ?? analyzed.summary?.packSize ?? ''),
    methods: Array.isArray(extracted.methods) ? extracted.methods.join(', ') : '',
    evidence: Array.isArray(extracted.evidence) ? extracted.evidence.join(' | ') : '',
    innerCount: extracted.innerCount != null ? String(extracted.innerCount) : '',
    innerUnitType: extracted.innerUnitType != null ? String(extracted.innerUnitType) : '',
    innerEvidence: extracted.innerEvidence != null ? String(extracted.innerEvidence) : '',
    innerSource: extracted.innerSource != null ? String(extracted.innerSource) : '',
    signals: formatSignals(extracted.allSignals),
    engineVersion: extracted.engineVersion ?? '',
  }
}

export function extractAmazonPackSizeFromCatalog(catalogJson) {
  const report = buildAmazonPackReport(catalogJson)
  const retail = resolveAmazonRetailPack(catalogJson)
  const warnings = [...(report.warnings ?? [])]
  if (retail.conflictNote) warnings.push(retail.conflictNote)
  return {
    packSize: retail.packSize,
    confidence: report.confidence,
    warnings,
    report: {
      ...report,
      packSize: retail.packSize,
      retailConflictNote: retail.conflictNote,
    },
  }
}

export const AMAZON_PACK_EXPORT_HEADERS = [
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

export function amazonPackExportCells(catalogJson) {
  if (!catalogJson) return AMAZON_PACK_EXPORT_HEADERS.map(() => '')
  const report = buildAmazonPackReport(catalogJson)
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
    Array.isArray(report.warnings) ? report.warnings.join(' | ') : '',
    report.engineVersion,
  ]
}
