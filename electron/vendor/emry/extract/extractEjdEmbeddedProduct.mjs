import {
  collapseWs,
  normalizeBrandName,
  normalizeTariffCode,
  normalizeUpcDigits,
  isPlausibleUnitOfMeasure,
} from './fieldHarvest.mjs'

/**
 * @param {string} html
 * @param {string} key
 */
function jsonStringField(html, key) {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i')
  const m = html.match(re)
  if (!m) return ''
  let value = m[1].replace(/\\"/g, '"').replace(/\\\//g, '/')
  value = value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
  return collapseWs(value)
}

/**
 * @param {string} html
 * @param {string} key
 */
function jsonNumberField(html, key) {
  const re = new RegExp(`"${key}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
  const m = html.match(re)
  if (!m) return NaN
  return Number.parseFloat(m[1])
}

/**
 * @param {string} value
 */
function isGarbageText(value) {
  if (!value || typeof value !== 'string') return true
  const v = value.trim()
  if (v.length < 1) return true
  if (v.length > 220) return true
  if (/[{}\[\]]/.test(v)) return true
  if (/"(?:MaterialDescription|ManufactureNumber|VendorName)"\s*:/.test(v)) return true
  if (/^#:?$/i.test(v)) return true
  if (/^:\s*"/.test(v)) return true
  if (/^":/.test(v)) return true
  if (/MaterialDescription|ManufactureNumber|VendorCode/i.test(v)) return true
  if (/","/.test(v)) return true
  return false
}

/**
 * @param {string} longDescription
 */
function brandFromLongDescription(longDescription) {
  const m = longDescription.match(/Brand\s*Name\s*:\s*([^*]+)/i)
  return m ? normalizeBrandName(m[1]) : ''
}

/**
 * EJD product detail pages embed a large JSON product model in HTML/JS.
 * Prefer these fields over fragile label scraping.
 * @param {string} html
 */
export function extractEjdEmbeddedProduct(html) {
  if (!html || html.length < 400) return null
  if (!/"MaterialDescription"|"ManufactureNumber"|"EachCost"|"RscQuantity"/i.test(html)) {
    return null
  }

  const materialDescription = jsonStringField(html, 'MaterialDescription')
  let title =
    jsonStringField(html, 'ProductName') ||
    jsonStringField(html, 'ItemName') ||
    jsonStringField(html, 'ProductDescription')
  const preMaterial = html.match(/"([^"\\]{8,200})"\s*,\s*"MaterialDescription"\s*:/)
  if (!title && preMaterial?.[1]) title = collapseWs(preMaterial[1])
  if (isGarbageText(title)) title = ''
  if (!title && materialDescription) title = materialDescription

  const mfg = jsonStringField(html, 'ManufactureNumber')
  const upc = normalizeUpcDigits(jsonStringField(html, 'PrimaryUpc') || jsonStringField(html, 'Upc'))
  const eachCost = jsonNumberField(html, 'EachCost')
  const caseCost = jsonNumberField(html, 'OrderMultipleCost')
  const orderMultiple = jsonNumberField(html, 'OrderMultiple')
  const storeRetail =
    jsonNumberField(html, 'StoreRetailAmount') ||
    jsonNumberField(html, 'StandardRetailAmount') ||
    jsonNumberField(html, 'Retail')

  const availableQty = jsonNumberField(html, 'RscQuantity')
  const rscSite = jsonStringField(html, 'FillRscNameWithState')
  const velocity = jsonStringField(html, 'Velocity').replace(/[^A-D]/gi, '').slice(0, 1).toUpperCase()

  let vendorId = jsonStringField(html, 'VendorCode').replace(/\D/g, '')
  if (vendorId.length > 6) vendorId = vendorId.replace(/^0+/, '').slice(-6)
  const vendorName = jsonStringField(html, 'VendorName')

  const primaryImageUrl = jsonStringField(html, 'PrimaryImageURL')
  const longDescription = jsonStringField(html, 'LongDescription')
  const brand = brandFromLongDescription(longDescription)

  const unitOfMeasure = jsonStringField(html, 'UnitOfMeasure')
  const omWeight = jsonNumberField(html, 'OrderMultipleWeight')
  const tariffCode = normalizeTariffCode(jsonStringField(html, 'TariffCode'))
  const countryOfOrigin = jsonStringField(html, 'CountryOfOrigin')
  const hazmat = jsonStringField(html, 'Hazmat')
  const nonReturnable = jsonStringField(html, 'NonReturnable')

  const stockIndicator = jsonStringField(html, 'StockIndicator')
  const statusCode = jsonStringField(html, 'StatusCode')

  if (!title && !mfg && !Number.isFinite(eachCost)) return null

  const logistics = {}
  if (isPlausibleUnitOfMeasure(unitOfMeasure)) {
    logistics.unit_of_measure = unitOfMeasure
  }
  if (Number.isFinite(omWeight)) logistics.om_weight_lbs = omWeight
  if (tariffCode) logistics.tariff_code = tariffCode
  if (countryOfOrigin) logistics.country_of_origin = countryOfOrigin
  if (hazmat) logistics.hazardous_material = /^yes$/i.test(hazmat)
  if (nonReturnable) logistics.returnable = !/^yes$/i.test(nonReturnable)

  let itemStatus = 'UNKNOWN'
  if (/discontinued/i.test(stockIndicator)) itemStatus = 'DISCONTINUED'
  else if (/in stock/i.test(stockIndicator) || statusCode === 'A') itemStatus = 'ACTIVE'

  return {
    title: isGarbageText(title) ? '' : title,
    mfg: isGarbageText(mfg) ? '' : mfg,
    brand_name: isGarbageText(brand) ? '' : normalizeBrandName(brand),
    upc,
    wholesaleCost: eachCost,
    caseCost,
    storeRetail,
    orderMultiple: Number.isFinite(orderMultiple) && orderMultiple >= 1 ? orderMultiple : NaN,
    availableQty: Number.isFinite(availableQty) ? Math.trunc(availableQty) : NaN,
    rscSite,
    velocity: /[ABCD]/.test(velocity) ? velocity : '',
    vendorId,
    vendorName,
    primaryImageUrl,
    logistics,
    itemStatus,
    isSpecialOrder: /special\s*order/i.test(stockIndicator),
  }
}

/**
 * @param {object} target
 * @param {ReturnType<typeof extractEjdEmbeddedProduct>} embedded
 */
export function applyEmbeddedProductFields(target, embedded) {
  if (!embedded) return target
  const out = { ...target }

  if (embedded.title && (isGarbageText(out.title) || !out.title)) out.title = embedded.title

  if (embedded.mfg && (isGarbageText(out.mfg) || !out.mfg)) out.mfg = embedded.mfg
  const embeddedBrand = embedded.brand_name ?? embedded.brand
  if (embeddedBrand && (isGarbageText(out.brand_name) || !out.brand_name)) {
    out.brand_name = embeddedBrand
  }
  if (embedded.upc && !out.upc) out.upc = embedded.upc

  if (Number.isFinite(embedded.wholesaleCost) && embedded.wholesaleCost > 0) {
    out.wholesaleCost = embedded.wholesaleCost
  }
  if (Number.isFinite(embedded.caseCost) && embedded.caseCost > 0) {
    out.caseCost = embedded.caseCost
  }
  if (Number.isFinite(embedded.storeRetail) && embedded.storeRetail > 0) {
    out.storeRetail = embedded.storeRetail
  }
  if (Number.isFinite(embedded.orderMultiple) && embedded.orderMultiple >= 1) {
    out.orderMultiple = embedded.orderMultiple
  }
  if (Number.isFinite(embedded.availableQty)) {
    out.availableQty = embedded.availableQty
  }
  if (embedded.rscSite) out.rscSite = embedded.rscSite
  if (embedded.velocity) out.velocity = embedded.velocity
  if (embedded.vendorId) out.vendorId = embedded.vendorId
  if (embedded.vendorName) out.vendorName = embedded.vendorName
  if (embedded.primaryImageUrl) out.primaryImageUrl = embedded.primaryImageUrl
  if (embedded.itemStatus !== 'UNKNOWN') out.itemStatus = embedded.itemStatus
  out.isSpecialOrder = embedded.isSpecialOrder

  out.logistics = { ...(out.logistics ?? {}), ...(embedded.logistics ?? {}) }
  if (out.logistics?.unit_of_measure && !isPlausibleUnitOfMeasure(out.logistics.unit_of_measure)) {
    delete out.logistics.unit_of_measure
  }
  if (out.logistics?.tariff_code) {
    out.logistics.tariff_code = normalizeTariffCode(out.logistics.tariff_code)
  }
  return out
}

export { isGarbageText }
