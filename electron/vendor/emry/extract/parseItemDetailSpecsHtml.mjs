import {
  classifyCompliance,
  collapseWs,
  extractUpcFromPlain,
  normalizeUpcDigits,
  isPlausibleUnitOfMeasure,
  normalizeTariffCode,
} from './fieldHarvest.mjs'
import { buildEjdProductRecord, hasMinimumIdentity } from './ejdRecordBuilder.mjs'
import {
  applyEmbeddedProductFields,
  extractEjdEmbeddedProduct,
} from './extractEjdEmbeddedProduct.mjs'

/**
 * Parse WhItemDetail / specs popup HTML into partial field objects for merge.
 * @param {string} html
 */
export function parseItemDetailSpecsHtml(html) {
  if (!html || html.length < 50) {
    return { logistics: {}, compliance: null, fields: {} }
  }

  const plain = html.replace(/<[^>]+>/g, ' ')
  const text = collapseWs(plain)

  const row = (label) => {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n|<]+)`, 'i')
    const m = plain.match(re)
    return m ? collapseWs(m[1]) : ''
  }

  const logistics = {}
  const uom = row('Unit Of Measure') || row('UOM')
  if (isPlausibleUnitOfMeasure(uom)) logistics.unit_of_measure = uom

  const omWeight = row('OM Weight').replace(/[^0-9.]/g, '')
  if (omWeight) logistics.om_weight_lbs = Number.parseFloat(omWeight)

  const tariff = normalizeTariffCode(row('Tariff Code'))
  if (tariff) logistics.tariff_code = tariff

  const returnable = row('Returnable')
  if (returnable) logistics.returnable = /^yes$/i.test(returnable)

  const hazmat = row('Hazardous Material')
  if (hazmat) logistics.hazardous_material = /^yes$/i.test(hazmat)

  const origin = row('Country of Origin')
  if (origin) logistics.country_of_origin = origin

  const eachCost = row('Each Cost').replace(/[^0-9.]/g, '')
  const omRaw = row('Order Multiple').replace(/\D/g, '')
  const velocity = row('Velocity').replace(/[^A-D]/gi, '').slice(0, 1).toUpperCase()
  let mfr = row('MFR #')
  if (!mfr || mfr.length > 40 || /^#:?$/i.test(mfr)) mfr = ''
  const upc = normalizeUpcDigits(extractUpcFromPlain(html))

  const specPresent = /specificationsTable|divProductSpecs|Each Cost|internet sales|prohibited|MAP/i.test(
    html,
  )
  const compliance = classifyCompliance(specPresent ? text : '', specPresent)

  let fields = {
    wholesaleCost: eachCost ? Number.parseFloat(eachCost) : NaN,
    orderMultiple: omRaw ? Number.parseInt(omRaw, 10) : NaN,
    mfg: mfr,
    upc,
    velocity: /[ABCD]/.test(velocity) ? velocity : '',
  }

  const embedded = extractEjdEmbeddedProduct(html)
  if (embedded) {
    fields = applyEmbeddedProductFields(
      {
        title: '',
        mfg: fields.mfg,
        brand_name: '',
        upc: fields.upc,
        wholesaleCost: fields.wholesaleCost,
        caseCost: NaN,
        storeRetail: NaN,
        orderMultiple: fields.orderMultiple,
        availableQty: NaN,
        rscSite: '',
        velocity: fields.velocity,
        vendorId: '',
        vendorName: '',
        primaryImageUrl: '',
        logistics,
        itemStatus: 'UNKNOWN',
        isSpecialOrder: false,
        ejdSku: '',
      },
      embedded,
    )
    Object.assign(logistics, embedded.logistics ?? {})
    if (embedded.mfg) fields.mfg = embedded.mfg
    if (embedded.upc) fields.upc = embedded.upc
    if (Number.isFinite(embedded.wholesaleCost)) fields.wholesaleCost = embedded.wholesaleCost
    if (Number.isFinite(embedded.orderMultiple)) fields.orderMultiple = embedded.orderMultiple
    if (embedded.velocity) fields.velocity = embedded.velocity
  }

  return { logistics, compliance, fields, embeddedTitle: embedded?.title ?? '' }
}

/**
 * Merge item-detail specs into an existing EJD record (fill gaps only).
 * @param {object} record
 * @param {ReturnType<typeof parseItemDetailSpecsHtml>} parsed
 */
export function mergeItemDetailIntoRecord(record, parsed) {
  if (!record || typeof record !== 'object') return record

  const out = { ...record }
  out.identity = { ...record.identity }
  out.commercials = { ...record.commercials }
  out.inventory = { ...record.inventory }

  if (parsed.fields.mfg && !out.identity.mfg_part_number) {
    out.identity.mfg_part_number = parsed.fields.mfg
  }
  if (parsed.fields.upc && !out.identity.upc) {
    out.identity.upc = parsed.fields.upc
  }
  if (Number.isFinite(parsed.fields.wholesaleCost) && parsed.fields.wholesaleCost > 0) {
    if (!out.commercials.wholesale_cost) {
      out.commercials.wholesale_cost = parsed.fields.wholesaleCost
    }
  }
  if (Number.isFinite(parsed.fields.orderMultiple) && parsed.fields.orderMultiple >= 1) {
    if (!out.commercials.order_multiple || out.commercials.order_multiple === 1) {
      out.commercials.order_multiple = parsed.fields.orderMultiple
    }
  }
  if (parsed.fields.velocity && !out.inventory.velocity) {
    out.inventory.velocity = parsed.fields.velocity
  }

  if (parsed.logistics && Object.keys(parsed.logistics).length > 0) {
    out.logistics = { ...(out.logistics ?? {}), ...parsed.logistics }
  }

  if (parsed.compliance && parsed.compliance.risk_level !== 'UNKNOWN') {
    out.compliance = parsed.compliance
  }

  return out
}

/**
 * Build a full EJD record from WhItemDetail HTML when iframe search HTML cannot be parsed.
 * @param {string} ejdSku
 * @param {string} targetUpc
 * @param {string} html
 * @param {{ storeContext?: string }} [options]
 */
export function buildEjdRecordFromItemDetailHtml(ejdSku, targetUpc, html, options = {}) {
  const sku = String(ejdSku ?? '').replace(/\D/g, '')
  if (!/^(?:\d{5}|\d{7})$/.test(sku)) return null

  const specs = parseItemDetailSpecsHtml(html)
  const embedded = extractEjdEmbeddedProduct(html)
  const upc = specs.fields.upc || embedded?.upc || normalizeUpcDigits(targetUpc)
  const fields = {
    ejdSku: sku,
    upc,
    mfg: specs.fields.mfg || embedded?.mfg || '',
    title: specs.embeddedTitle || embedded?.title || '',
    brand_name: embedded?.brand_name || embedded?.brand || '',
    vendorId: embedded?.vendorId || '',
    vendorName: embedded?.vendorName || '',
    wholesaleCost: Number.isFinite(specs.fields.wholesaleCost)
      ? specs.fields.wholesaleCost
      : embedded?.wholesaleCost,
    storeRetail: embedded?.storeRetail ?? NaN,
    orderMultiple: Number.isFinite(specs.fields.orderMultiple)
      ? specs.fields.orderMultiple
      : embedded?.orderMultiple ?? 1,
    availableQty: Number.isFinite(embedded?.availableQty) ? embedded.availableQty : 0,
    rscSite: embedded?.rscSite || '',
    itemStatus: embedded?.itemStatus || 'UNKNOWN',
    isSpecialOrder: embedded?.isSpecialOrder ?? false,
    velocity: specs.fields.velocity || embedded?.velocity || '',
    compliance: specs.compliance ?? {
      marketplace_prohibited: null,
      restriction_policy_text: null,
      risk_level: 'UNKNOWN',
    },
  }

  if (!hasMinimumIdentity(fields, targetUpc)) return null

  let confidence = 0.55
  if (Number.isFinite(fields.wholesaleCost) && fields.wholesaleCost > 0) confidence += 0.15
  if (fields.mfg) confidence += 0.1
  if (fields.velocity) confidence += 0.05
  if (upc === targetUpc) confidence += 0.15

  return buildEjdProductRecord(fields, targetUpc, {
    storeContext: options.storeContext,
    confidence: Math.min(1, confidence),
    logistics: { ...specs.logistics, ...(embedded?.logistics ?? {}) },
    caseCost: embedded?.caseCost,
    media: embedded?.primaryImageUrl ? { primary_image_url: embedded.primaryImageUrl } : undefined,
  })
}
