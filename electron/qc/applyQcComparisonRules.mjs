import { buildQcCoreComparisons, QC_CORE_EMPTY } from './qcCoreFieldMap.mjs'
import {
  brandNamesMatchForCompare,
  modelCompareOutcome,
  titleSimilarityPercent,
  upcDigitsEqual,
} from './qcFieldCompare.mjs'
import { derivePackCompareOutcome, resolveAmazonRetailPack } from './packSizeResolve.mjs'
import { isUsableUrl } from './haikuImagePrep.mjs'
import { extractAmazonPackSizeFromCatalog } from './spApiPackAdapter.mjs'
import { extractDescriptionTexts, extractSpecificationTexts } from './qcExtraFields.mjs'
import { runHaikuTitleImageScores } from './anthropicHaiku.mjs'
import { combineQcVerdict } from './qcVerdict.mjs'
const GATE_COMPARISON_KEY_RE = /^gate\d+$/

function isBrandAliasMatch(vendorBrand, amazonBrand, aliases) {
  const vendor = String(vendorBrand ?? '').trim()
  const amazon = String(amazonBrand ?? '').trim()
  if (!vendor || !amazon || !Array.isArray(aliases) || aliases.length === 0) return false
  return aliases.some(
    (row) =>
      String(row.vendorBrand ?? '').trim() === vendor &&
      String(row.amazonBrand ?? '').trim() === amazon,
  )
}

function withOutcome(row, outcome, extra = {}) {
  return { ...row, outcome, ...extra }
}

function isEmptyCoreValue(value) {
  const t = String(value ?? '').trim()
  return !t || t === QC_CORE_EMPTY
}

/**
 * @param {object} input
 * @param {unknown} input.vendorExtract
 * @param {unknown} input.catalogJson
 * @param {object} input.settings
 * @param {object[]} input.brandAliases
 * @param {object[]} input.gateComparisons
 * @param {'PASS'|'FAIL'|'MANUAL_REVIEW'} input.gateVerdict
 */
export async function applyQcComparisonRules(input) {
  const log = []
  const settings = input.settings ?? {}
  const brandAliases = input.brandAliases ?? []
  let inputTokens = 0
  let outputTokens = 0
  let amazonPackReport = null

  const titleThreshold = Number(settings.titleSimilarityPercent) || 70
  const imageThreshold = Number(settings.imageSimilarityPercent) || 70

  const coreRows = buildQcCoreComparisons(input.vendorExtract, input.catalogJson)
  const comparisons = []

  const byKey = (key) => coreRows.find((r) => r.key === key)

  let packRow = byKey('pack')
  let amazonPackResolved = null
  if (input.catalogJson && packRow) {
    const extracted = extractAmazonPackSizeFromCatalog(input.catalogJson)
    amazonPackReport = extracted.report ?? null
    amazonPackResolved = resolveAmazonRetailPack(input.catalogJson)
    packRow = {
      ...packRow,
      targetValue: String(amazonPackResolved.packSize),
    }
    if (extracted.warnings?.length) {
      log.push(`Pack engine warnings: ${extracted.warnings.join('; ')}`)
    }
    if (amazonPackResolved.conflictNote) {
      log.push(amazonPackResolved.conflictNote)
    }
    log.push(`Amazon retail pack: ${amazonPackResolved.packSize}`)
  }

  const brandRow = byKey('brand')
  if (brandRow) {
    let outcome = 'MISMATCH'
    if (isEmptyCoreValue(brandRow.sourceValue) || isEmptyCoreValue(brandRow.targetValue)) {
      outcome = 'REVIEW'
    } else if (
      isBrandAliasMatch(brandRow.sourceValue, brandRow.targetValue, brandAliases) ||
      brandNamesMatchForCompare(brandRow.sourceValue, brandRow.targetValue)
    ) {
      outcome = 'MATCH'
    }
    comparisons.push(withOutcome(brandRow, outcome))
  }

  const modelRow = byKey('model')
  if (modelRow) {
    const outcome = modelCompareOutcome(modelRow.sourceValue, modelRow.targetValue)
    comparisons.push(withOutcome(modelRow, outcome))
  }

  if (packRow) {
    const vendorPack = packRow.sourceValue === QC_CORE_EMPTY ? '' : packRow.sourceValue
    let outcome = 'REVIEW'
    if (amazonPackResolved) {
      outcome = derivePackCompareOutcome(
        Number.parseInt(String(vendorPack).replace(/\D/g, ''), 10) || 1,
        amazonPackResolved,
      )
      if (amazonPackResolved.conflictNote) {
        comparisons.push({
          key: 'pack_conflict',
          label: 'Pack conflict',
          sourceValue: String(vendorPack),
          targetValue: amazonPackResolved.conflictNote,
          outcome: 'REVIEW',
        })
      }
    } else if (packRow.targetValue !== QC_CORE_EMPTY) {
      const v = Number.parseInt(String(vendorPack).replace(/\D/g, ''), 10)
      const a = Number.parseInt(String(packRow.targetValue).replace(/\D/g, ''), 10)
      outcome = Number.isFinite(v) && Number.isFinite(a) && v === a ? 'MATCH' : 'MISMATCH'
    }
    comparisons.push(withOutcome(packRow, outcome))
  }

  const titleRow = byKey('title')
  const imageRow = byKey('image')
  let titleHasOutcome = false
  let imageHasOutcome = false

  if (titleRow) {
    comparisons.push({ ...titleRow })
  }

  if (imageRow) {
    const vendorUrl = imageRow.sourceValue
    const amazonUrl = imageRow.targetValue
    if (!isUsableUrl(vendorUrl) || !isUsableUrl(amazonUrl)) {
      comparisons.push(withOutcome(imageRow, 'MISMATCH'))
      imageHasOutcome = true
      log.push('Image: missing URL — core FAIL')
    } else {
      comparisons.push({ ...imageRow })
    }
  }

  const upcRow = byKey('upc')
  if (upcRow) {
    const match = upcDigitsEqual(upcRow.sourceValue, upcRow.targetValue)
    comparisons.push(withOutcome(upcRow, match ? 'MATCH' : 'MISMATCH'))
  }

  const descThreshold = Number(settings.descriptionSimilarityPercent) || 70
  const specThreshold = Number(settings.specificationSimilarityPercent) || 70

  const descTexts = extractDescriptionTexts(input.vendorExtract, input.catalogJson)
  if (descTexts.vendorText && descTexts.amazonText) {
    const sim = titleSimilarityPercent(descTexts.vendorText, descTexts.amazonText)
    comparisons.push({
      key: 'description',
      label: 'DESCRIPTION',
      sourceValue: descTexts.vendorText,
      targetValue: descTexts.amazonText,
      outcome: sim >= descThreshold ? 'MATCH' : 'MISMATCH',
      scorePercent: sim,
    })
  }

  const specTexts = extractSpecificationTexts(input.vendorExtract, input.catalogJson)
  if (specTexts.vendorText && specTexts.amazonText) {
    const sim = titleSimilarityPercent(specTexts.vendorText, specTexts.amazonText)
    comparisons.push({
      key: 'specifications',
      label: 'SPECIFICATIONS',
      sourceValue: specTexts.vendorText,
      targetValue: specTexts.amazonText,
      outcome: sim >= specThreshold ? 'MATCH' : 'MISMATCH',
      scorePercent: sim,
    })
  }

  const upcMatchedForContext =
    comparisons.find((c) => c.key === 'upc')?.outcome === 'MATCH' ||
    upcDigitsEqual(byKey('upc')?.sourceValue, byKey('upc')?.targetValue)

  const coreKeys = ['title', 'brand', 'pack', 'model', 'upc', 'image']
  const missingCoreLabels = []
  for (const key of coreKeys) {
    const idx = comparisons.findIndex((c) => c.key === key)
    const row = idx >= 0 ? comparisons[idx] : undefined
    if (!row || isEmptyCoreValue(row.sourceValue) || isEmptyCoreValue(row.targetValue)) {
      missingCoreLabels.push(row?.label ?? key.toUpperCase())
      if (idx >= 0) comparisons[idx] = withOutcome(comparisons[idx], 'MISMATCH')
    }
  }
  const skipModelQc = missingCoreLabels.length > 0
  if (skipModelQc) {
    log.push(`Skipped model QC — missing ${missingCoreLabels.join(', ')} — FAIL`)
    const titleIdx = comparisons.findIndex((c) => c.key === 'title')
    if (titleIdx >= 0 && comparisons[titleIdx].outcome === 'MISMATCH') {
      titleHasOutcome = true
    } else if (titleIdx >= 0 && comparisons[titleIdx].outcome == null) {
      const row = comparisons[titleIdx]
      const sim = titleSimilarityPercent(row.sourceValue, row.targetValue)
      comparisons[titleIdx] = withOutcome(row, sim >= titleThreshold ? 'MATCH' : 'MISMATCH', {
        scorePercent: sim,
      })
      titleHasOutcome = true
    }
    const imageIdx = comparisons.findIndex((c) => c.key === 'image')
    if (imageIdx >= 0 && comparisons[imageIdx].outcome != null) imageHasOutcome = true
  }

  if (titleRow && !skipModelQc) {
    const vendorModelForTitle = modelRow?.sourceValue === QC_CORE_EMPTY ? '' : modelRow?.sourceValue
    const amazonModelForTitle = modelRow?.targetValue === QC_CORE_EMPTY ? '' : modelRow?.targetValue

    const haiku = await runHaikuTitleImageScores(
      titleRow.sourceValue,
      titleRow.targetValue,
      imageRow?.sourceValue,
      imageRow?.targetValue,
      {
        vendorModel: vendorModelForTitle,
        amazonModel: amazonModelForTitle,
        upcMatch: upcMatchedForContext,
      },
    )
    if (haiku?.blocked) {
      log.push(haiku.reason)
    } else if (haiku) {
      inputTokens += haiku.inputTokens
      outputTokens += haiku.outputTokens

      if (haiku.titlePercent != null) {
        const idx = comparisons.findIndex((c) => c.key === 'title')
        if (idx >= 0) {
          const outcome = haiku.titlePercent >= titleThreshold ? 'MATCH' : 'MISMATCH'
          comparisons[idx] = withOutcome(comparisons[idx], outcome, {
            scorePercent: haiku.titlePercent,
          })
          titleHasOutcome = true
        }
      }

      if (!imageHasOutcome && haiku.imagePercent != null) {
        const idx = comparisons.findIndex((c) => c.key === 'image')
        if (idx >= 0) {
          let outcome = haiku.imagePercent >= imageThreshold ? 'MATCH' : 'MISMATCH'
          const modelOk =
            comparisons.find((c) => c.key === 'model')?.outcome === 'MATCH' ||
            comparisons.find((c) => c.key === 'model')?.outcome === 'REVIEW'
          if (outcome === 'MISMATCH' && upcMatchedForContext && modelOk && haiku.imagePercent >= 40) {
            outcome = 'MATCH'
            log.push(`Image: promoted to MATCH (UPC+model + Haiku ${haiku.imagePercent}%)`)
          }
          comparisons[idx] = withOutcome(comparisons[idx], outcome, {
            scorePercent: haiku.imagePercent,
          })
          imageHasOutcome = true
        }
      }

      log.push(
        `Haiku scores: title ${haiku.titlePercent ?? '—'}% (≥${titleThreshold}%), image ${haiku.imagePercent ?? '—'}% (≥${imageThreshold}%) · ${haiku.inputTokens} in / ${haiku.outputTokens} out tokens`,
      )
    } else {
      log.push('Haiku title/image: unavailable — manual review for unresolved fields')
    }

  }

  const gates = (input.gateComparisons ?? []).filter((row) =>
    GATE_COMPARISON_KEY_RE.test(String(row?.key ?? '')),
  )
  comparisons.push(...gates)

  const verdict = combineQcVerdict({
    comparisons,
    gateVerdict: input.gateVerdict ?? 'PASS',
    titleHasOutcome,
    imageHasOutcome,
  })

  return {
    comparisons,
    verdict,
    titleHasOutcome,
    imageHasOutcome,
    log,
    inputTokens,
    outputTokens,
    amazonPackReport,
  }
}
