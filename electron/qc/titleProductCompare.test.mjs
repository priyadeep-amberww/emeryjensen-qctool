import assert from 'node:assert/strict'
import test from 'node:test'
import { modelCompareOutcome } from './qcFieldCompare.mjs'
import { titlesReferToSameProduct } from './titleProductCompare.mjs'
import { combineQcVerdict } from './qcVerdict.mjs'

test('Leviton vendor vs Amazon model numbers match', () => {
  assert.equal(
    modelCompareOutcome('R52-T5820-0WS', 'T5820-WS-8pk'),
    'MATCH',
  )
})

test('short vendor title matches long Amazon title when model aligns', () => {
  assert.equal(
    titlesReferToSameProduct(
      'Eastman Access Panel',
      'Eastman 6 Inch x 6 Inch Access Panel with Frame, 34060, White',
      '34060',
      '34060',
    ),
    true,
  )
})

test('core miss yields FAIL even when UPC and model match', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'title', outcome: 'MATCH' },
      { key: 'pack', outcome: 'MISMATCH' },
      { key: 'brand', outcome: 'MISMATCH' },
      { key: 'image', outcome: 'MISMATCH' },
    ],
  })
  assert.equal(verdict, 'FAIL')
})
