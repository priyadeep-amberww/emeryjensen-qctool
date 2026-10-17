import { pruneProductResultsHtml } from './pruneProductResultsHtml.mjs'
import {
  classifyCompliance,
  collapseWs,
  extractSkuFromLabels,
  extractUpcFromPlain,
  extractUpcForTarget,
  harvest,
  moneyAmounts,
  normalizeUpcDigits,
  normalizeBrandName,
  splitVendorIdName,
  UPC_RE,
  isPlausibleUnitOfMeasure,
  normalizeTariffCode,
} from './fieldHarvest.mjs'
import {
  buildEjdProductRecord,
  confidenceScore,
  hasMinimumIdentity,
} from './ejdRecordBuilder.mjs'
import { parseRscQuantityText } from './rscQuantity.mjs'
import {
  applyEmbeddedProductFields,
  extractEjdEmbeddedProduct,
  isGarbageText,
} from './extractEjdEmbeddedProduct.mjs'

/**
 * @param {string} html
 */
export function isProductDetailPage(html) {
  if (!html || html.length < 200) return false
  const lower = html.toLowerCase()
  const markers = [
    'add to cart',
    'store retail',
    'ship method',
    'rsc qty',
    'shopping cart',
  ]
  const hits = markers.filter((m) => lower.includes(m)).length
  const hasSku = Boolean(extractSkuFromLabels(html)) || /sku\s*:/i.test(html)
  if (hits >= 2 && hasSku) return true
  if (hits >= 1 && hasSku) return true
  if (lower.includes('add to cart') && hasSku) return true
  return false
}

/**
 * @param {string} html
 */
function extractPrimaryImageUrl(html) {
  const imgMatch = html.match(
    /<img[^>]+class="[^"]*(?:productImage|mainImage|primaryImage)[^"]*"[^>]+src="([^"]+)"/i,
  )
  if (imgMatch?.[1]) return imgMatch[1]
  const gallery = html.match(/<div[^>]*class="[^"]*imageGallery[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)
  if (gallery?.[1]) return gallery[1]
  const any = html.match(/<img[^>]+src="(https?:\/\/[^"]+product[^"]+)"/i)
  return any?.[1] ?? ''
}

/**
 * @param {string} html
 */
function extractTitle(html) {
  const fromClass = harvest(html, {
    classRe: /class="[^"]*(?:productTitle|itemTitle|pageTitle)[^"]*"[^>]*>([^<]+)/i,
  })
  if (fromClass && !isGarbageText(fromClass)) return fromClass
  const h1 = html.match(/<h1[^>]*>([^<]+)/i)
  if (h1?.[1]) {
    const t = collapseWs(h1[1])
    if (!isGarbageText(t)) return t
  }
  const desc = harvest(html, { labels: ['Description'] })
  return isGarbageText(desc) ? '' : desc
}

/**
 * @param {string} plain
 */
function parseSpecsTable(plain) {
  const logistics = {}
  const row = (label) => {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n|]+)`, 'i')
    const m = plain.match(re)
    return m ? collapseWs(m[1]) : ''
  }

  const eachCost = row('Each Cost').replace(/[^0-9.]/g, '')
  const omWeight = row('OM Weight').replace(/[^0-9.]/g, '')
  const uom = row('Unit Of Measure') || row('UOM')
  const velocity = row('Velocity').replace(/[^A-D]/gi, '').slice(0, 1).toUpperCase()
  const tariff = normalizeTariffCode(row('Tariff Code'))
  const returnable = row('Returnable')
  const hazmat = row('Hazardous Material')
  const origin = row('Country of Origin')
  let mfrSpecs = row('MFR #')
  if (isGarbageText(mfrSpecs) || mfrSpecs.length > 40) mfrSpecs = ''

  if (isPlausibleUnitOfMeasure(uom)) logistics.unit_of_measure = uom
  if (omWeight) logistics.om_weight_lbs = Number.parseFloat(omWeight)
  if (returnable) logistics.returnable = /^yes$/i.test(returnable)
  if (hazmat) logistics.hazardous_material = /^yes$/i.test(hazmat)
  if (origin) logistics.country_of_origin = origin
  if (tariff) logistics.tariff_code = tariff

  return {
    logistics,
    eachCostFromSpecs: eachCost ? Number.parseFloat(eachCost) : NaN,
    velocityFromSpecs: /[ABCD]/.test(velocity) ? velocity : '',
    mfrFromSpecs: mfrSpecs,
  }
}

/**
 * @param {string} html
 */
function extractDetailFields(html) {
  const plain = html.replace(/<[^>]+>/g, ' ')
  const text = collapseWs(plain)

  const ejdSku = extractSkuFromLabels(html) || extractSkuFromLabels(plain)
  let upc = normalizeUpcDigits(extractUpcFromPlain(html))
  if (!upc) {
    const upcHit = plain.match(UPC_RE)
    if (upcHit) upc = normalizeUpcDigits(upcHit[1])
  }

  const title = extractTitle(html)
  let mfg = harvest(html, {
    classRe: /class="[^"]*mfgPartNo[^"]*"[^>]*>([^<]+)/i,
    labels: ['MFR', 'MFR #'],
  })
  const vendorRaw = harvest(html, {
    classRe: /class="[^"]*vendorName[^"]*"[^>]*>([^<]+)/i,
    labels: ['Vendor'],
  })
  const { vendorId, vendorName } = splitVendorIdName(vendorRaw)

  const retailRaw = harvest(html, {
    classRe: /class="[^"]*(?:retailAmount|priceRetail)[^"]*"[^>]*>\s*\$?\s*([^<]+)/i,
    labels: ['STORE RETAIL', 'RETAIL'],
  })
  const storeRetail = Number.parseFloat(retailRaw.replace(/[^0-9.]/g, ''))

  const omRaw = harvest(html, {
    classRe: /class="[^"]*orderMultiple[^"]*"[^>]*>([^<]+)/i,
    labels: ['OM', 'Order Multiple'],
  })
  let orderMultiple = omRaw ? Number.parseInt(omRaw.replace(/\D/g, ''), 10) : 1

  const qtyRaw = harvest(html, {
    classRe: /class="[^"]*(?:rscQty|availQty)[^"]*"[^>]*>([^<]+)/i,
    labels: ['RSC QTY', 'RSC Qty', 'Available'],
  })
  const { availableQty, availableOtherWarehouses } = parseRscQuantityText(qtyRaw)

  const rscSite = harvest(html, {
    classRe: /class="[^"]*rscLocation[^"]*"[^>]*>([^<]+)/i,
    labels: ['RSC', 'Fill Site'],
  })

  const amounts = moneyAmounts(text)
  let wholesaleCost = NaN
  let caseCost = NaN
  const costSection = text.match(/COST[\s\S]{0,120}/i)?.[0] ?? text
  const costAmounts = moneyAmounts(costSection)
  if (costAmounts.length >= 1) wholesaleCost = costAmounts[0]
  if (costAmounts.length >= 2) caseCost = costAmounts[1]
  if (!Number.isFinite(wholesaleCost) && amounts.length >= 1) {
    wholesaleCost = amounts[0]
  }

  const specs = parseSpecsTable(plain)
  if (!Number.isFinite(wholesaleCost) && Number.isFinite(specs.eachCostFromSpecs)) {
    wholesaleCost = specs.eachCostFromSpecs
  }
  if (specs.mfrFromSpecs && !mfg) mfg = specs.mfrFromSpecs
  if (specs.logistics && !orderMultiple) {
    const omSpec = rowFromPlain(plain, 'Order Multiple')
    if (omSpec) orderMultiple = Number.parseInt(omSpec, 10) || 1
  }

  let velocity = harvest(html, {
    labels: ['Velocity'],
    regex: /Velocity\s*:?\s*([ABCD])/i,
  }).slice(0, 1).toUpperCase()
  if (!/[ABCD]/.test(velocity)) velocity = specs.velocityFromSpecs

  const brand = normalizeBrandName(harvest(html, { labels: ['Brand'] }))
  const isSpecialOrder = /special\s*order/i.test(text)
  let itemStatus = 'UNKNOWN'
  if (/DISCONTINUED/i.test(text)) itemStatus = 'DISCONTINUED'
  else if (/ACTIVE/i.test(text)) itemStatus = 'ACTIVE'
  else if (isSpecialOrder) itemStatus = 'SPECIAL_ORDER'
  else if (availableQty > 0 || availableOtherWarehouses) itemStatus = 'ACTIVE'

  const specPresent = /specificationsTable|divProductSpecs|Each Cost|Vendor Internet Sales Policy/i.test(
    html,
  )
  const compliance = classifyCompliance(specPresent ? text : '', specPresent)

  const primaryImageUrl = extractPrimaryImageUrl(html)

  let fields = {
    ejdSku,
    upc,
    title,
    mfg,
    brand_name: brand,
    vendorId,
    vendorName,
    wholesaleCost,
    storeRetail,
    caseCost,
    orderMultiple: Number.isFinite(orderMultiple) && orderMultiple >= 1 ? orderMultiple : 1,
    availableQty,
    availableOtherWarehouses,
    rscSite,
    itemStatus,
    isSpecialOrder,
    velocity: /[ABCD]/.test(velocity) ? velocity : '',
    compliance,
    logistics: specs.logistics,
    primaryImageUrl,
  }

  const embedded = extractEjdEmbeddedProduct(html)
  fields = applyEmbeddedProductFields(fields, embedded)
  if (isGarbageText(fields.title)) fields.title = embedded?.title ?? ''
  if (isGarbageText(fields.mfg)) fields.mfg = embedded?.mfg ?? ''
  if (isGarbageText(fields.brand_name)) {
    fields.brand_name = embedded?.brand_name ?? embedded?.brand ?? ''
  }

  return fields
}

/**
 * @param {string} plain
 * @param {string} label
 */
function rowFromPlain(plain, label) {
  const re = new RegExp(`${label}\\s*:?\\s*([^\\n|]+)`, 'i')
  const m = plain.match(re)
  return m ? collapseWs(m[1]).replace(/\D/g, '') : ''
}

/**
 * @param {string} html
 * @param {string} targetUpc
 * @param {{ storeContext?: string }} [options]
 */
export function parseProductDetailHtml(html, targetUpc, options = {}) {
  if (!isProductDetailPage(html)) {
    return { status: 'not_applicable', record: null, confidence: 0, cardCount: 0 }
  }

  const pageUpc = extractUpcForTarget(html, targetUpc)
  if (pageUpc && pageUpc !== targetUpc) {
    return { status: 'not_applicable', record: null, confidence: 0, cardCount: 0 }
  }

  const { fragment } = pruneProductResultsHtml(html)
  const body = fragment && fragment.length > 80 ? fragment : html
  const fields = extractDetailFields(body)

  if (!fields.ejdSku) {
    return { status: 'bad_parse', record: null, confidence: 0, cardCount: 1 }
  }

  const confidence = confidenceScore(fields, targetUpc, { detailPage: true })
  if (!hasMinimumIdentity(fields, targetUpc)) {
    return { status: 'bad_parse', record: null, confidence, cardCount: 1 }
  }

  const record = buildEjdProductRecord(fields, targetUpc, {
    storeContext: options.storeContext,
    confidence,
    caseCost: fields.caseCost,
    logistics: fields.logistics,
    media: fields.primaryImageUrl ? { primary_image_url: fields.primaryImageUrl } : undefined,
  })

  return {
    status: 'captured',
    record,
    confidence,
    cardCount: 1,
    parseWarning: confidence < 1,
    pageKind: 'product_detail',
  }
}
