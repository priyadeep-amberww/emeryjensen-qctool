import assert from 'node:assert/strict'
import test from 'node:test'
import { combineQcVerdict } from './qcVerdict.mjs'

test('UPC match: title/image mismatch is MANUAL_REVIEW not FAIL', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'brand', outcome: 'MATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'pack', outcome: 'MATCH' },
      { key: 'title', outcome: 'MISMATCH' },
      { key: 'image', outcome: 'MISMATCH' },
    ],
    gateVerdict: 'PASS',
    titleHasOutcome: true,
    imageHasOutcome: true,
  })
  assert.equal(verdict, 'MANUAL_REVIEW')
})

test('UPC + model + title match: PASS even when brand/image differ', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'brand', outcome: 'MISMATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'pack', outcome: 'REVIEW' },
      { key: 'title', outcome: 'MATCH' },
      { key: 'image', outcome: 'MISMATCH' },
    ],
    gateVerdict: 'PASS',
    titleHasOutcome: true,
    imageHasOutcome: true,
  })
  assert.equal(verdict, 'PASS')
})
