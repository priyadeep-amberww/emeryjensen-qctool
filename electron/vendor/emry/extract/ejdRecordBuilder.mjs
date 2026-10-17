/**
 * @param {object} fields
 * @param {string} targetUpc
 * @param {{ detailPage?: boolean }} [opts]
 */
export function confidenceScore(fields, targetUpc, opts = {}) {
  let score = 0
  if (/^[0-9]{5,7}$/.test(fields.ejdSku)) score += 0.2
  if (fields.upc === targetUpc || (!fields.upc && targetUpc)) score += 0.2
  if (Number.isFinite(fields.wholesaleCost) && fields.wholesaleCost > 0) score += 0.15
  if (Number.isInteger(fields.orderMultiple) && fields.orderMultiple >= 1) score += 0.1
  if (Number.isInteger(fields.availableQty) && fields.availableQty >= 0) score += 0.1
  if (opts.detailPage) {
    if (fields.title) score += 0.1
    if (fields.mfg) score += 0.1
    if (fields.rscSite) score += 0.05
  }
  return Math.min(1, score)
}

import { normalizeBrandName } from './fieldHarvest.mjs'

/**
 * @param {object} winner
 * @param {string} targetUpc
 * @param {{ storeContext?: string, confidence?: number, logistics?: object, media?: object, caseCost?: number }} options
 */
export function buildEjdProductRecord(winner, targetUpc, options = {}) {
  const confidence = options.confidence ?? confidenceScore(winner, targetUpc)
  const caseCost = options.caseCost ?? winner.caseCost
  const commercials = {
    wholesale_cost: Number.isFinite(winner.wholesaleCost) ? winner.wholesaleCost : 0,
    store_retail_msrp: Number.isFinite(winner.storeRetail) ? winner.storeRetail : 0,
    order_multiple: winner.orderMultiple >= 1 ? winner.orderMultiple : 1,
    currency: 'USD',
  }
  if (Number.isFinite(caseCost) && caseCost > 0) {
    commercials.case_cost = caseCost
  }

  const record = {
    identity: {
      ejd_sku: winner.ejdSku,
      upc: winner.upc || targetUpc,
      mfg_part_number: winner.mfg || '',
      title: winner.title || '',
      brand_name: normalizeBrandName(winner.brand_name || winner.brand || ''),
      vendor: {
        id: winner.vendorId || '',
        name: winner.vendorName || '',
      },
    },
    commercials,
    inventory: {
      rsc_site: (winner.rscSite || '').toUpperCase(),
      available_qty: winner.availableQty,
      is_in_stock: winner.availableQty > 0 && !winner.isSpecialOrder,
      is_special_order: winner.isSpecialOrder,
      item_status: winner.itemStatus,
      velocity: winner.velocity || null,
    },
    compliance: winner.compliance,
    provenance: {
      extracted_at: new Date().toISOString(),
      search_term_used: targetUpc,
      store_context: options.storeContext ?? '34533',
      parsing_confidence_score: confidence,
    },
  }

  if (options.logistics && Object.keys(options.logistics).length > 0) {
    record.logistics = options.logistics
  }
  if (options.media?.primary_image_url) {
    record.media = options.media
  }

  return record
}

/**
 * Minimum fields to accept a parse when confidence is below 0.7.
 * @param {object} fields
 * @param {string} targetUpc
 */
export function hasMinimumIdentity(fields, targetUpc) {
  if (!/^[0-9]{5,7}$/.test(fields.ejdSku)) return false
  if (fields.upc && fields.upc !== targetUpc) return false
  return true
}
