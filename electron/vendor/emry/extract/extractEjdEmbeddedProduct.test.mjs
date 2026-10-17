import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractEjdEmbeddedProduct } from './extractEjdEmbeddedProduct.mjs'
import { parseProductDetailHtml } from './parseProductDetailHtml.mjs'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
const html = readFileSync(path.join(dir, 'sta-bil-embedded.html'), 'utf8')
const upc = '073905220040'

const embedded = extractEjdEmbeddedProduct(html)
assert.ok(embedded)
assert.equal(embedded.mfg, '22004')
assert.equal(embedded.orderMultiple, 6)
assert.equal(embedded.title, 'STA-BIL Starting Fluid 11 oz')
assert.equal(embedded.brand_name, 'STA-BIL')

const parsed = parseProductDetailHtml(html, upc)
assert.equal(parsed.status, 'captured')
assert.equal(parsed.record.identity.mfg_part_number, '22004')
assert.equal(parsed.record.identity.title, 'STA-BIL Starting Fluid 11 oz')
assert.equal(parsed.record.commercials.order_multiple, 6)
assert.equal(parsed.record.media?.primary_image_url, embedded.primaryImageUrl)

console.log('extractEjdEmbeddedProduct ok')
