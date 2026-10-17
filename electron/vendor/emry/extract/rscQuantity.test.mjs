import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRscQuantityText } from './rscQuantity.mjs'

test('other warehouses text is not treated as missing product', () => {
  const parsed = parseRscQuantityText('Available in other warehouses')
  assert.equal(parsed.availableQty, 0)
  assert.equal(parsed.availableOtherWarehouses, true)
})
