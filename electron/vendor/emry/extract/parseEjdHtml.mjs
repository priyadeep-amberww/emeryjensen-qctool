import { parseProductDetailHtml, isProductDetailPage } from './parseProductDetailHtml.mjs'
import { parseProductResultsHtml } from './parseProductResults.mjs'

/**
 * @param {object} result
 */
function commercialRichness(record) {
  if (!record?.commercials) return 0
  let n = 0
  if (record.commercials.wholesale_cost > 0) n += 2
  if (record.commercials.store_retail_msrp > 0) n += 1
  if (record.commercials.order_multiple > 1) n += 1
  if (record.commercials.case_cost > 0) n += 1
  return n
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} targetUpc
 */
function pickBetterParse(a, b, targetUpc) {
  if (!a?.record && !b?.record) return a?.status === 'captured' ? a : b
  if (!a?.record) return b
  if (!b?.record) return a

  const upcA = a.record.identity?.upc === targetUpc
  const upcB = b.record.identity?.upc === targetUpc
  if (upcA && !upcB) return a
  if (upcB && !upcA) return b

  const confDiff = (a.confidence ?? 0) - (b.confidence ?? 0)
  if (Math.abs(confDiff) > 0.05) return confDiff > 0 ? a : b

  const richA = commercialRichness(a.record)
  const richB = commercialRichness(b.record)
  return richA >= richB ? a : b
}

/**
 * Run detail + results parsers and return the best capture.
 * @param {string} html
 * @param {string} targetUpc
 * @param {{ storeContext?: string }} [options]
 */
export function parseEjdHtml(html, targetUpc, options = {}) {
  const detailFirst = isProductDetailPage(html)
  const detail = parseProductDetailHtml(html, targetUpc, options)
  const grid = detailFirst
    ? { status: 'not_applicable', record: null, confidence: 0, cardCount: 0 }
    : parseProductResultsHtml(html, targetUpc, options)

  let winner
  if (detailFirst) {
    winner = pickBetterParse(detail, grid, targetUpc)
  } else {
    winner = pickBetterParse(grid, detail, targetUpc)
  }

  if (winner?.status === 'captured' && winner.record) {
    return winner
  }
  if (detail.status === 'captured') return detail
  if (grid.status === 'captured') return grid

  if (detail.status === 'bad_parse' || grid.status === 'bad_parse') {
    return {
      status: 'bad_parse',
      record: null,
      confidence: Math.max(detail.confidence ?? 0, grid.confidence ?? 0),
      cardCount: (grid.cardCount ?? 0) + (detail.cardCount ?? 0),
    }
  }

  return grid.status === 'not_on_portal' ? grid : detail
}
