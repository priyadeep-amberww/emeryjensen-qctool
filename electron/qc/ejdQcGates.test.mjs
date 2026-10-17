import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateEjdQcGates } from './ejdQcGates.mjs'

const vendorBase = {
  identity: { upc: '080351810060' },
  compliance: { risk_level: 'GREEN_CLEAR' },
  inventory: { available_qty: 0, velocity: 'D' },
  commercials: { wholesale_cost: 18.73, order_multiple: 4 },
}

const catalog = {
  identifiers: [{ identifiers: [{ identifierType: 'UPC', identifier: '080351810060' }] }],
}

test('gates: low stock and zero qty do not fail QC', async () => {
  const result = await evaluateEjdQcGates({
    vendorExtract: vendorBase,
    catalogJson: catalog,
    captureStatus: 'captured',
    asin: 'B005WI2DOG',
  })
  assert.equal(result.verdict, 'PASS')
  assert.ok(!result.log.some((line) => /profit|stock|inventory|Gate 5|Gate 4/i.test(line)))
})

test('gates: RED_BLOCKED fails QC', async () => {
  const result = await evaluateEjdQcGates({
    vendorExtract: {
      ...vendorBase,
      compliance: { risk_level: 'RED_BLOCKED', restriction_policy_text: 'blocked' },
    },
    catalogJson: catalog,
    captureStatus: 'captured',
    asin: 'B0CGXZV2VT',
  })
  assert.equal(result.verdict, 'FAIL')
})
