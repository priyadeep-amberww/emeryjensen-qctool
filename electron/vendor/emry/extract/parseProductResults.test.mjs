import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseProductResultsHtml } from './parseProductResults.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const upc = '079118100810'

const none = parseProductResultsHtml(readFileSync(path.join(dir, 'none.html'), 'utf8'), upc)
assert.equal(none.status, 'not_on_portal')

const one = parseProductResultsHtml(readFileSync(path.join(dir, 'one.html'), 'utf8'), upc)
assert.equal(one.status, 'captured')
assert.equal(one.record.identity.ejd_sku, '8485823')
assert.equal(one.record.commercials.wholesale_cost, 10.64)
assert.equal(one.record.inventory.velocity, 'A')
assert.equal(one.record.compliance.risk_level, 'UNKNOWN')
assert.equal(one.record.compliance.marketplace_prohibited, null)

const many = parseProductResultsHtml(readFileSync(path.join(dir, 'many.html'), 'utf8'), upc)
assert.equal(many.cardCount, 2)
assert.equal(many.record.identity.ejd_sku, '8485823')
assert.equal(many.record.inventory.item_status, 'ACTIVE')

console.log('parseProductResults fixtures ok')
