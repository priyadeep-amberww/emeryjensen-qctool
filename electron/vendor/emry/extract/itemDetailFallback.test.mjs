import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEjdRecordFromItemDetailHtml } from './parseItemDetailSpecsHtml.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const html = readFileSync(path.join(dir, 'item-detail-specs.html'), 'utf8')
const record = buildEjdRecordFromItemDetailHtml('1025120', '817939018545', html)
assert.ok(record)
assert.equal(record.identity.ejd_sku, '1025120')
assert.equal(record.commercials.wholesale_cost, 3.47)
assert.equal(record.commercials.order_multiple, 6)

console.log('item detail fallback ok')
