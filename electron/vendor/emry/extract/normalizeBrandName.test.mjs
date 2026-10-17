import assert from 'node:assert/strict'
import { normalizeBrandName } from './fieldHarvest.mjs'

assert.equal(normalizeBrandName('Name: Drano'), 'Drano')
assert.equal(normalizeBrandName('Brand Name: STA-BIL'), 'STA-BIL')
assert.equal(normalizeBrandName('Drano'), 'Drano')

console.log('normalizeBrandName ok')
