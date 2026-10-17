import assert from 'node:assert/strict'
import test from 'node:test'
import { flattenFilteredAmazonAttributes } from '../amazonAttributeFilter.mjs'
import {
  brandNamesMatchForCompare,
  modelCompareOutcome,
} from '../qcFieldCompare.mjs'
import { extractAmazonCoreFields, extractVendorCoreFields } from '../qcCoreFieldMap.mjs'
import {
  derivePackCompareOutcome,
  extractVendorRetailPack,
  resolveAmazonRetailPack,
} from '../packSizeResolve.mjs'
import { SIX_SKU_FIXTURES } from './sixSkuQc.fixture.mjs'

function brandOutcome(vendorBrand, amazonBrand) {
  const v = String(vendorBrand ?? '').trim()
  const a = String(amazonBrand ?? '').trim()
  if (!v || !a) return 'REVIEW'
  return brandNamesMatchForCompare(v, a) ? 'MATCH' : 'MISMATCH'
}

for (const fixture of SIX_SKU_FIXTURES) {
  test(`six-sku ${fixture.name}: amazon core extract`, () => {
    const amazon = extractAmazonCoreFields(fixture.amazon)
    assert.equal(amazon.brand, fixture.expect.amazonBrand)
    assert.equal(amazon.model, fixture.expect.amazonModel)
  })

  test(`six-sku ${fixture.name}: vendor retail pack`, () => {
    const pack = extractVendorRetailPack(fixture.ejd)
    assert.equal(pack, fixture.expect.vendorPack)
    const vendor = extractVendorCoreFields(fixture.ejd)
    assert.equal(vendor.packVendor, String(fixture.expect.vendorPack))
  })

  test(`six-sku ${fixture.name}: amazon retail pack`, () => {
    const resolved = resolveAmazonRetailPack(fixture.amazon)
    assert.equal(resolved.packSize, fixture.expect.amazonPack)
    if (fixture.expect.packConflict) {
      assert.ok(resolved.conflictNote.includes('Amazon pack conflict'))
    }
  })

  test(`six-sku ${fixture.name}: compare outcomes`, () => {
    const vendor = extractVendorCoreFields(fixture.ejd)
    const amazon = extractAmazonCoreFields(fixture.amazon)
    const resolved = resolveAmazonRetailPack(fixture.amazon)

    assert.equal(brandOutcome(vendor.brand, amazon.brand), fixture.expect.brandOutcome)
    assert.equal(modelCompareOutcome(vendor.model, amazon.model), fixture.expect.modelOutcome)
    assert.equal(
      derivePackCompareOutcome(fixture.expect.vendorPack, resolved),
      fixture.expect.packOutcome,
    )
  })

  if (fixture.expect.specMustNotInclude) {
    test(`six-sku ${fixture.name}: filtered specifications`, () => {
      const attrs = fixture.amazon.attributes ?? {}
      const text = flattenFilteredAmazonAttributes(attrs).join(' | ')
      for (const fragment of fixture.expect.specMustNotInclude) {
        assert.ok(!text.includes(fragment), `spec text should not include ${fragment}`)
      }
    })
  }
}
