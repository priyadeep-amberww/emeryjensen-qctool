import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseProductDetailHtml } from './parseProductDetailHtml.mjs'
import { parseEjdHtml } from './parseEjdHtml.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

const methodHtml = readFileSync(path.join(dir, 'method-detail.html'), 'utf8')
const methodUpc = '817939018545'
const method = parseProductDetailHtml(methodHtml, methodUpc)
assert.equal(method.status, 'captured')
assert.equal(method.record.identity.ejd_sku, '1025120')
assert.equal(method.record.identity.mfg_part_number, '01854')
assert.equal(method.record.commercials.wholesale_cost, 3.47)
assert.equal(method.record.commercials.case_cost, 20.82)
assert.equal(method.record.commercials.order_multiple, 6)
assert.equal(method.record.commercials.store_retail_msrp, 5.99)
assert.equal(method.record.inventory.available_qty, 84)
assert.equal(method.record.inventory.velocity, 'C')
assert.equal(method.record.logistics.tariff_code, '3401305000')
assert.ok(method.record.media?.primary_image_url?.includes('method-hand-wash'))

const swifferHtml = readFileSync(path.join(dir, 'swiffer-detail.html'), 'utf8')
const swifferUpc = '037000236801'
const swiffer = parseProductDetailHtml(swifferHtml, swifferUpc)
assert.equal(swiffer.status, 'captured')
assert.equal(swiffer.record.identity.ejd_sku, '1025274')
assert.equal(swiffer.record.commercials.wholesale_cost, 5.83)
assert.equal(swiffer.record.commercials.order_multiple, 4)
assert.equal(swiffer.record.inventory.available_qty, 916)
assert.equal(swiffer.record.inventory.velocity, 'A')

const row813 = parseEjdHtml(
  readFileSync(path.join(dir, 'row8136803-detail.html'), 'utf8'),
  '079100509607',
)
assert.equal(row813.status, 'captured')
assert.equal(row813.record.identity.ejd_sku, '8136803')
assert.equal(row813.record.commercials.wholesale_cost, 9.99)

console.log('parseProductDetailHtml fixtures ok')
