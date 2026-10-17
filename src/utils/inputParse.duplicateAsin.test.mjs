import assert from 'node:assert/strict'
import {
  analyzeDuplicateAsins,
  dedupeRowsByFirstAsin,
  validateRows,
} from './inputParse.ts'

const fields = [
  { id: 'part_sku', label: 'PART SKU', kind: 'text' },
  { id: 'asin', label: 'ASIN', kind: 'asin' },
  { id: 'upc', label: 'UPC', kind: 'upc' },
]

const rows = [
  { part_sku: 'A', asin: 'B000000001', upc: '012345678905' },
  { part_sku: 'A', asin: 'B000000002', upc: '012345678905' },
  { part_sku: 'B', asin: 'B000000001', upc: '012345678912' },
]

assert.equal(validateRows(rows, fields).length, 0)

const { warnings, skippedRowNumbers } = analyzeDuplicateAsins(rows, fields)
assert.equal(warnings.length, 1)
assert.equal(skippedRowNumbers[0], 3)

const deduped = dedupeRowsByFirstAsin(rows, fields)
assert.equal(deduped.length, 2)
assert.equal(deduped[1].asin, 'B000000002')

console.log('duplicate asin upload rules ok')
