import { pruneProductResultsHtml } from './pruneProductResultsHtml.mjs'
import {
  classifyCompliance,
  harvest,
  normalizeBrandName,
  normalizeUpcDigits,
  splitVendorIdName,
  UPC_RE,
  MONEY_RE,
} from './fieldHarvest.mjs'
import {
  buildEjdProductRecord,
  confidenceScore,
  hasMinimumIdentity,
} from './ejdRecordBuilder.mjs'
import { parseRscQuantityText } from './rscQuantity.mjs'

export { classifyCompliance } from './fieldHarvest.mjs'

/**
 * @param {string} cardHtml
 */
function extractCardFields(cardHtml) {
  const text = cardHtml.replace(/<[^>]+>/g, ' ')
  let upc = harvest(cardHtml, {
    classRe: /class="[^"]*upcValue[^"]*"[^>]*>([^<]+)/i,
    labels: ['UPC'],
    regex: UPC_RE,
  }).replace(/\D/g, '')
  upc = normalizeUpcDigits(upc) || upc

  const ejdSku = harvest(cardHtml, {
    classRe: /class="[^"]*skuValue[^"]*"[^>]*>([^<]+)/i,
    labels: ['SKU', 'SKU#'],
    regex: /SKU\s*#?\s*:?\s*([0-9]{5,7})\b/i,
  }).replace(/\D/g, '')

  const title = harvest(cardHtml, {
    classRe: /class="[^"]*(?:productTitle|itemDesc)[^"]*"[^>]*>([^<]+)/i,
    labels: ['Description'],
    regex: /<h3[^>]*>\s*<a[^>]*>([^<]+)/i,
  })

  const mfg = harvest(cardHtml, {
    classRe: /class="[^"]*mfgPartNo[^"]*"[^>]*>([^<]+)/i,
    labels: ['MFG', 'MFG #'],
  })

  const vendorRaw = harvest(cardHtml, {
    classRe: /class="[^"]*vendorName[^"]*"[^>]*>([^<]+)/i,
    labels: ['Vendor'],
  })
  const { vendorId, vendorName } = splitVendorIdName(vendorRaw)

  const costRaw = harvest(cardHtml, {
    classRe: /class="[^"]*(?:costAmount|priceCost)[^"]*"[^>]*>\s*\$?\s*([^<]+)/i,
    labels: ['COST'],
    regex: MONEY_RE,
  })
  const retailRaw = harvest(cardHtml, {
    classRe: /class="[^"]*(?:retailAmount|priceRetail)[^"]*"[^>]*>\s*\$?\s*([^<]+)/i,
    labels: ['RETAIL', 'STORE RETAIL'],
  })
  const wholesaleCost = Number.parseFloat(costRaw.replace(/[^0-9.]/g, ''))
  const storeRetail = Number.parseFloat(retailRaw.replace(/[^0-9.]/g, ''))

  const omRaw = harvest(cardHtml, {
    classRe: /class="[^"]*orderMultiple[^"]*"[^>]*>([^<]+)/i,
    labels: ['OM', 'Order Multiple'],
  })
  const orderMultiple = omRaw ? Number.parseInt(omRaw, 10) : 1

  const qtyRaw = harvest(cardHtml, {
    classRe: /class="[^"]*(?:rscQty|availQty)[^"]*"[^>]*>([^<]+)/i,
    labels: ['RSC Qty', 'Available', 'In Stock'],
  })
  const { availableQty, availableOtherWarehouses } = parseRscQuantityText(qtyRaw)

  const rscSite = harvest(cardHtml, {
    classRe: /class="[^"]*rscLocation[^"]*"[^>]*>([^<]+)/i,
    labels: ['RSC', 'Fill Site'],
  })

  const statusText = harvest(cardHtml, {
    classRe: /class="[^"]*itemStatus[^"]*"[^>]*>([^<]+)/i,
    labels: ['Status'],
  }).toUpperCase()
  let itemStatus = 'UNKNOWN'
  if (/DISCONTINUED/i.test(statusText)) itemStatus = 'DISCONTINUED'
  else if (/ACTIVE/i.test(statusText)) itemStatus = 'ACTIVE'
  else if (/SPECIAL\s*ORDER/i.test(text)) itemStatus = 'SPECIAL_ORDER'

  const isSpecialOrder = /special\s*order/i.test(text)
  const brand = normalizeBrandName(harvest(cardHtml, { labels: ['Brand'] }))
  const velocity = harvest(cardHtml, {
    labels: ['Velocity'],
    regex: /Velocity\s*:?\s*([ABCD])/i,
  }).slice(0, 1).toUpperCase()

  const specPresent = /specificationsTable|divProductSpecs|Vendor Internet Sales Policy/i.test(cardHtml)
  const specText = specPresent ? text : ''
  const compliance = classifyCompliance(specText, specPresent)

  return {
    ejdSku,
    upc,
    title,
    mfg,
    brand,
    vendorId,
    vendorName,
    wholesaleCost,
    storeRetail,
    orderMultiple: Number.isFinite(orderMultiple) && orderMultiple >= 1 ? orderMultiple : 1,
    availableQty,
    availableOtherWarehouses,
    rscSite,
    itemStatus,
    isSpecialOrder,
    velocity: /[ABCD]/.test(velocity) ? velocity : '',
    compliance,
    cardText: text.replace(/\s+/g, ' ').trim().slice(0, 4000),
  }
}

/**
 * @param {string} fragment
 */
function splitProductCards(fragment) {
  const cards = []
  const patterns = [
    /<div[^>]*class="[^"]*productItem[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*productItem|$)/gi,
    /<tr[^>]*class="[^"]*rgRow[^"]*"[^>]*>[\s\S]*?<\/tr>/gi,
    /<tr[^>]*class="[^"]*rgAltRow[^"]*"[^>]*>[\s\S]*?<\/tr>/gi,
  ]
  for (const pattern of patterns) {
    const matches = fragment.match(pattern)
    if (matches && matches.length > 0) {
      cards.push(...matches)
      break
    }
  }
  if (cards.length === 0 && fragment.length > 200) {
    cards.push(fragment)
  }
  return cards
}

/**
 * @param {ReturnType<typeof extractCardFields>[]} candidates
 * @param {string} targetUpc
 */
function pickBestCard(candidates, targetUpc) {
  if (candidates.length === 0) return null
  const exact = candidates.filter((c) => c.upc === targetUpc)
  const pool = exact.length > 0 ? exact : candidates

  const scored = pool.map((c) => {
    let score = 0
    if (c.upc === targetUpc) score += 100
    if (c.itemStatus === 'ACTIVE') score += 50
    else if (c.itemStatus === 'DISCONTINUED') score -= 20
    if (c.availableQty > 0 || c.availableOtherWarehouses) score += 30
    if (c.ejdSku) score += 10
    return { card: c, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.card ?? null
}

/**
 * @param {string} html
 * @param {string} targetUpc
 * @param {{ storeContext?: string }} [options]
 */
export function parseProductResultsHtml(html, targetUpc, options = {}) {
  const { fragment, noRecords } = pruneProductResultsHtml(html)
  if (!fragment || fragment.length < 80) {
    return { status: 'not_on_portal', record: null, confidence: 0, cardCount: 0 }
  }

  const cards = splitProductCards(fragment)
  if (cards.length === 0 && noRecords) {
    return { status: 'not_on_portal', record: null, confidence: 0, cardCount: 0 }
  }

  const parsed = cards.map((c) => extractCardFields(c))
  const winner = pickBestCard(parsed, targetUpc)
  if (!winner || !winner.ejdSku) {
    if (noRecords || parsed.every((p) => !p.ejdSku)) {
      return { status: 'not_on_portal', record: null, confidence: 0, cardCount: cards.length }
    }
    return { status: 'bad_parse', record: null, confidence: 0, cardCount: cards.length }
  }

  const confidence = confidenceScore(winner, targetUpc)
  if (!hasMinimumIdentity(winner, targetUpc)) {
    return { status: 'bad_parse', record: null, confidence, cardCount: cards.length }
  }

  const record = buildEjdProductRecord(winner, targetUpc, {
    storeContext: options.storeContext,
    confidence,
  })

  return {
    status: 'captured',
    record,
    confidence,
    cardCount: cards.length,
    parseWarning: confidence < 0.7 || confidence < 1,
    pageKind: 'product_results',
  }
}
