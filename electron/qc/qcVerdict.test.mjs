import assert from 'node:assert/strict'
import test from 'node:test'
import { combineQcVerdict } from './qcVerdict.mjs'

test('any core miss is FAIL', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'brand', outcome: 'MATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'pack', outcome: 'MATCH' },
      { key: 'title', outcome: 'MISMATCH' },
      { key: 'image', outcome: 'MISMATCH' },
    ],
  })
  assert.equal(verdict, 'FAIL')
})

test('pack review or mismatch is FAIL', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'brand', outcome: 'MATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'pack', outcome: 'REVIEW' },
      { key: 'title', outcome: 'MATCH' },
      { key: 'image', outcome: 'MATCH' },
    ],
  })
  assert.equal(verdict, 'FAIL')
})

test('all six MATCH is PASS', () => {
  const verdict = combineQcVerdict({
    comparisons: [
      { key: 'upc', outcome: 'MATCH' },
      { key: 'brand', outcome: 'MATCH' },
      { key: 'model', outcome: 'MATCH' },
      { key: 'pack', outcome: 'MATCH' },
      { key: 'title', outcome: 'MATCH' },
      { key: 'image', outcome: 'MATCH' },
    ],
  })
  assert.equal(verdict, 'PASS')
})
