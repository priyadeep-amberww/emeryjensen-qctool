import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEjdHtml } from './parseEjdHtml.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

/** Upload rows: ASIN, UPC, part_sku — EJD truth from portal fixtures. */
const rows = [
  {
    upc: '817939018545',
    expectedSku: '1025120',
    om: 6,
    cost: 3.47,
    fixture: 'method-detail.html',
  },
  {
    upc: '037000236801',
    expectedSku: '1025274',
    om: 4,
    cost: 5.83,
    fixture: 'swiffer-detail.html',
  },
  {
    upc: '079100509607',
    expectedSku: '8136803',
    om: 1,
    cost: 9.99,
    fixture: 'row8136803-detail.html',
  },
]

for (const row of rows) {
  const html = readFileSync(path.join(dir, row.fixture), 'utf8')
  const parsed = parseEjdHtml(html, row.upc)
  assert.equal(parsed.status, 'captured', `${row.upc} should capture`)
  assert.equal(parsed.record.identity.ejd_sku, row.expectedSku, `${row.upc} SKU`)
  assert.equal(parsed.record.commercials.order_multiple, row.om, `${row.upc} OM`)
  assert.equal(parsed.record.commercials.wholesale_cost, row.cost, `${row.upc} cost`)
  assert.ok(
    (parsed.confidence ?? 0) > 0.7,
    `${row.upc} confidence should exceed 0.7`,
  )
}

console.log('golden upload row fixtures ok')
