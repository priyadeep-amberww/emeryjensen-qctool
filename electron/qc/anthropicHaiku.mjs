import { getDecryptedValues } from '../credentialsStore.mjs'
import { estimateInputTokens, loadAiTokenCaps } from '../aiTokenCaps.mjs'
import { fetchAndResizeImageBase64, isUsableUrl } from './haikuImagePrep.mjs'

export const HAIKU_MODEL = 'claude-haiku-5-5'

/**
 * @returns {Promise<string>}
 */
export async function loadAnthropicApiKey() {
  const values = await getDecryptedValues(['ANTHROPIC_API_KEY'])
  const apiKey = values.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      'Missing Claude API key. Save ANTHROPIC_API_KEY on the Credentials page before running QC.',
    )
  }
  return apiKey
}

/**
 * @param {object} params
 * @returns {Promise<{ verdict: string, fieldOutcomes: Record<string, string>, inputTokens: number, outputTokens: number }>}
 */
export async function runHaikuListingQc(params) {
  const apiKey = await loadAnthropicApiKey()
  const {
    vendorExtract,
    amazonExtract,
    thresholds,
    brandAliases,
    comparisons,
  } = params

  const userPayload = {
    thresholds,
    brandAliases,
    vendor: {
      title: vendorExtract.title,
      imageUrl: vendorExtract.imageUrl,
      brand: vendorExtract.brand,
      modelNumber: vendorExtract.modelNumber,
      packSize: vendorExtract.packSize,
      upc: vendorExtract.upc,
      priceUsd: vendorExtract.rawAttributes?.priceUsd,
    },
    amazon: {
      title: amazonExtract.title,
      imageUrl: amazonExtract.imageUrl,
      brand: amazonExtract.brand,
      modelNumber: amazonExtract.modelNumber,
      packSize: amazonExtract.packSize,
      upc: amazonExtract.upc,
      priceUsd: amazonExtract.rawAttributes?.priceUsd,
    },
    fields: comparisons.map((c) => c.key),
  }

  const system = [
    'You are a product listing QC assistant comparing vendor data to Amazon catalog data.',
    'Respond with ONLY a single JSON object, no markdown.',
    'Schema:',
    '{"verdict":"PASS"|"FAIL"|"MANUAL_REVIEW","fields":{"title":"MATCH"|"MISMATCH"|"REVIEW",...}}',
    'Use MANUAL_REVIEW when uncertain. Use brand alias rules when vendor brand maps to Amazon brand.',
    `Title match threshold: ${thresholds.titleSimilarityPercent}% conceptual similarity.`,
    `Image match threshold: ${thresholds.imageSimilarityPercent}% (URL or visual description if URLs differ).`,
    'Price within ~15% variance is MATCH; slightly outside is REVIEW; far is MISMATCH.',
  ].join(' ')

  const userContent = JSON.stringify(userPayload)
  const caps = await loadAiTokenCaps()
  const estimatedInput = estimateInputTokens(`${system}\n${userContent}`)
  if (caps.outputTokens < 1) {
    throw new Error(
      'Claude output token cap is 0. Raise the output cap on the Settings page before QC can call Haiku.',
    )
  }
  if (estimatedInput > caps.inputTokens) {
    throw new Error(
      `Claude input is about ${estimatedInput} tokens, above the saved cap of ${caps.inputTokens}. Raise the input cap on the Settings page or shorten the listing data.`,
    )
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: caps.outputTokens,
      output_config: { effort: 'low' },
      system,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 240)
    try {
      const json = JSON.parse(text)
      detail = json?.error?.message ?? json?.message ?? detail
    } catch {
      /* use snippet */
    }
    throw new Error(`Claude QC request failed (HTTP ${res.status}): ${detail}`)
  }

  let messageJson
  try {
    messageJson = JSON.parse(text)
  } catch {
    throw new Error('Claude QC response was not valid JSON.')
  }

  const contentBlock = messageJson?.content?.find((c) => c.type === 'text')
  const rawText = contentBlock?.text?.trim()
  if (!rawText) {
    throw new Error('Claude QC response did not include text content.')
  }

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Claude QC returned text that was not valid JSON.')
  }

  const verdict = String(parsed.verdict ?? '').toUpperCase()
  if (!['PASS', 'FAIL', 'MANUAL_REVIEW'].includes(verdict)) {
    throw new Error(`Claude QC returned an invalid verdict: ${parsed.verdict}`)
  }

  const fieldOutcomes = {}
  const fields = parsed.fields ?? {}
  for (const [key, value] of Object.entries(fields)) {
    const outcome = String(value).toUpperCase()
    if (outcome === 'MATCH' || outcome === 'MISMATCH' || outcome === 'REVIEW') {
      fieldOutcomes[key] = outcome
    }
  }

  const inputTokens = Number(messageJson?.usage?.input_tokens) || 0
  const outputTokens = Number(messageJson?.usage?.output_tokens) || 0

  return { verdict, fieldOutcomes, inputTokens, outputTokens }
}

function clampPercent(value) {
  const n = Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

/**
 * One Haiku call: title and image similarity percents (0–100) for live capture QC.
 * @returns {Promise<
 *   | { blocked: true, reason: string }
 *   | { blocked?: false, titlePercent: number|null, imagePercent: number|null, inputTokens: number, outputTokens: number }
 *   | null
 * >}
 */
export async function runHaikuTitleImageScores(
  vendorTitle,
  amazonTitle,
  vendorImageUrl,
  amazonImageUrl,
  context = {},
) {
  const vendor = String(vendorTitle ?? '').trim()
  const amazon = String(amazonTitle ?? '').trim()
  if (!vendor || !amazon || vendor === '—' || amazon === '—') return null

  let apiKey
  try {
    apiKey = await loadAnthropicApiKey()
  } catch {
    return null
  }

  const vendorModel = String(context.vendorModel ?? '').trim()
  const amazonModel = String(context.amazonModel ?? '').trim()
  const upcMatch = context.upcMatch === true

  const system = [
    'You score vendor vs Amazon listing pairs for QC. Respond with ONLY JSON, no markdown:',
    '{"titlePercent":0,"imagePercent":0}',
    'titlePercent (0-100): Score whether both titles refer to the SAME physical sellable SKU, not text similarity.',
    'Vendor titles are often very short; Amazon titles are long. Short vs long is still 85-100 when specs align (model, size, gauge, length, color, count).',
    'Use vendorModel and amazonModel when provided: same catalog model with different prefix/suffix (R52-T5820-0WS vs T5820-WS) = high titlePercent.',
    'Low titlePercent only when a spec changes the product (different model, size, gauge, voltage, pack count, color that changes SKU).',
    'imagePercent (0-100): Same product = high even when photos differ a lot.',
    'Treat as SAME product (high score): assembled vs disassembled, exploded view, installation diagram, line art vs photo, white background vs lifestyle, vendor stock art vs Amazon render, different angle/zoom.',
    'Low imagePercent only for clearly different item, wrong color variant, or wrong pack quantity visible.',
    'Return integers only. No verdict field.',
  ].join(' ')

  const userContent = []

  const contextLines = [
    `Vendor title: ${vendor}`,
    `Amazon title: ${amazon}`,
    vendorModel ? `Vendor model/part: ${vendorModel}` : '',
    amazonModel ? `Amazon model/part: ${amazonModel}` : '',
    upcMatch ? 'UPC already verified match between vendor and Amazon.' : '',
  ].filter(Boolean)

  userContent.push({
    type: 'text',
    text: contextLines.join('\n'),
  })

  const vendorImg = isUsableUrl(vendorImageUrl)
    ? await fetchAndResizeImageBase64(vendorImageUrl)
    : null
  const amazonImg = isUsableUrl(amazonImageUrl)
    ? await fetchAndResizeImageBase64(amazonImageUrl)
    : null

  if (vendorImg) {
    userContent.push({ type: 'text', text: 'Vendor product image:' })
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: vendorImg.mediaType, data: vendorImg.data },
    })
  }
  if (amazonImg) {
    userContent.push({ type: 'text', text: 'Amazon product image:' })
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: amazonImg.mediaType, data: amazonImg.data },
    })
  }

  const caps = await loadAiTokenCaps()
  const estimateBlob = `${system}\n${vendor}\n${amazon}`
  const estimatedInput = estimateInputTokens(estimateBlob) + (vendorImg ? 800 : 0) + (amazonImg ? 800 : 0)
  if (caps.outputTokens < 1) {
    return {
      blocked: true,
      reason: `Adaptive restriction: output token cap is ${caps.outputTokens}. Raise it before Haiku can run.`,
    }
  }
  if (estimatedInput > caps.inputTokens) {
    return {
      blocked: true,
      reason: `Adaptive restriction: estimated input ${estimatedInput} tokens exceeds cap ${caps.inputTokens}. Call skipped.`,
    }
  }

  const maxTokens = Math.min(caps.outputTokens, 250)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: maxTokens,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  const text = await res.text()
  if (!res.ok) return null

  let messageJson
  try {
    messageJson = JSON.parse(text)
  } catch {
    return null
  }

  const contentBlock = messageJson?.content?.find((c) => c.type === 'text')
  const rawText = contentBlock?.text?.trim()
  if (!rawText) return null

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  const titlePercent = clampPercent(parsed.titlePercent)
  const imagePercent = clampPercent(parsed.imagePercent)
  if (titlePercent == null && imagePercent == null) return null

  return {
    titlePercent,
    imagePercent,
    inputTokens: Number(messageJson?.usage?.input_tokens) || 0,
    outputTokens: Number(messageJson?.usage?.output_tokens) || 0,
  }
}

/**
 * @deprecated Live capture uses runHaikuTitleImageScores.
 * @returns {Promise<{ yes: boolean, inputTokens: number, outputTokens: number } | null>}
 */
export async function runHaikuTitleCompare(vendorTitle, amazonTitle) {
  const vendor = String(vendorTitle ?? '').trim()
  const amazon = String(amazonTitle ?? '').trim()
  if (!vendor || !amazon || vendor === '—' || amazon === '—') return null

  let apiKey
  try {
    apiKey = await loadAnthropicApiKey()
  } catch {
    return null
  }

  const system = [
    'You compare two product listing titles (vendor vs Amazon).',
    'Respond with ONLY JSON: {"title":"YES"} or {"title":"NO"}. No markdown.',
    'YES when both titles refer to the same sellable product or same product category even if wording differs completely.',
    'NO when they disagree on color, model number, size, volume, gauge, count, pack, or any spec that changes the physical product (e.g. 2L vs 1L, 18 gauge vs 24 gauge).',
    'No uncertainty — only YES or NO.',
  ].join(' ')

  const userContent = JSON.stringify({ vendorTitle: vendor, amazonTitle: amazon })
  const caps = await loadAiTokenCaps()
  const estimatedInput = estimateInputTokens(`${system}\n${userContent}`)
  if (caps.outputTokens < 1 || estimatedInput > caps.inputTokens) return null

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: Math.min(caps.outputTokens, 64),
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  const text = await res.text()
  if (!res.ok) return null

  let messageJson
  try {
    messageJson = JSON.parse(text)
  } catch {
    return null
  }

  const contentBlock = messageJson?.content?.find((c) => c.type === 'text')
  const rawText = contentBlock?.text?.trim()
  if (!rawText) return null

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  const titleAnswer = String(parsed.title ?? '').toUpperCase()
  if (titleAnswer !== 'YES' && titleAnswer !== 'NO') return null

  return {
    yes: titleAnswer === 'YES',
    inputTokens: Number(messageJson?.usage?.input_tokens) || 0,
    outputTokens: Number(messageJson?.usage?.output_tokens) || 0,
  }
}
