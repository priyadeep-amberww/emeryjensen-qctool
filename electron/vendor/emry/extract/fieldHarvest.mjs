export const UPC_RE = /\b([0-9]{12})\b/
export const MONEY_RE = /\$\s*(\d+\.\d{2})/
export const SKU_LABEL_RE = /SKU\s*#?\s*:?\s*([0-9]{5,7})\b/i

/**
 * @param {string} text
 */
export function collapseWs(text) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} raw
 */
export function normalizeBrandName(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let v = collapseWs(raw)
  v = v.replace(/^brand\s*name\s*:?\s*/i, '')
  v = v.replace(/^name\s*:?\s*/i, '')
  return v.trim()
}

/**
 * @param {string} raw
 */
export function isPlausibleUnitOfMeasure(raw) {
  const v = collapseWs(raw)
  if (!v || v === '/') return false
  if (/^\(UOM\)$/i.test(v)) return false
  if (/unit\s*of\s*measure/i.test(v)) return false
  return v.length <= 24
}

/**
 * @param {string} raw
 */
export function normalizeTariffCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length > 10) return digits.slice(-10)
  return digits
}

/**
 * @param {string} html
 * @param {string} label
 */
export function valueAfterLabel(html, label) {
  const re = new RegExp(`${label}\\s*:?\\s*([^<\\n]+)`, 'i')
  const m = html.match(re)
  return m ? collapseWs(m[1]) : ''
}

/**
 * @param {string} raw
 */
export function normalizeUpcDigits(raw) {
  let upc = String(raw ?? '').replace(/\D/g, '')
  if (upc.length === 11) upc = `0${upc}`
  return upc.length === 12 ? upc : ''
}

/**
 * @param {string} cardHtml
 * @param {{ classRe?: RegExp, labels?: string[], regex?: RegExp }} spec
 */
/**
 * @param {string} value
 */
export function isGarbageHarvestValue(value) {
  if (!value) return true
  const v = value.trim()
  if (v.length > 180) return true
  if (/[{}\[\]]/.test(v)) return true
  if (/"(?:MaterialDescription|ManufactureNumber|VendorCode)"\s*:/.test(v)) return true
  if (/^#:?$/i.test(v)) return true
  if (/^:\s*"/.test(v)) return true
  if (/\\",\\"/.test(v)) return true
  if (/MaterialDescription|ManufactureNumber/i.test(v)) return true
  if (/^":/.test(v)) return true
  if (/","/.test(v)) return true
  return false
}

export function harvest(cardHtml, spec) {
  if (spec.classRe) {
    const hit = cardHtml.match(spec.classRe)
    if (hit?.[1]) {
      const val = collapseWs(hit[1])
      if (!isGarbageHarvestValue(val)) return val
    }
  }
  const plain = cardHtml.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  for (const label of spec.labels ?? []) {
    const labeled = valueAfterLabel(plain, label)
    if (labeled && !isGarbageHarvestValue(labeled)) return labeled
  }
  if (spec.regex) {
    const hit = plain.match(spec.regex)
    if (hit?.[1]) return collapseWs(hit[1])
  }
  return ''
}

/**
 * @param {string} vendorRaw
 */
export function splitVendorIdName(vendorRaw) {
  let vendorId = ''
  let vendorName = vendorRaw
  const vendorIdMatch = vendorRaw.match(/^(\d{4,6})[-\s]+(.+)/)
  if (vendorIdMatch) {
    vendorId = vendorIdMatch[1]
    vendorName = vendorIdMatch[2].trim()
  }
  return { vendorId, vendorName }
}

/**
 * @param {string} specText
 * @param {boolean} specPresent
 */
export function classifyCompliance(specText, specPresent) {
  if (!specPresent) {
    return {
      marketplace_prohibited: null,
      restriction_policy_text: null,
      risk_level: 'UNKNOWN',
    }
  }
  const text = specText || ''
  const hard =
    /prohibited|not authorized|restricted distribution|do not sell online/i.test(text) &&
    /(marketplace|amazon|third[- ]party|ebay|walmart|internet sales)/i.test(text)
  const sentence =
    text.match(
      /((?:vendor internet sales policy|sale of this product)[^.]{0,280}\.)/i,
    )?.[1] ?? null
  if (hard) {
    return {
      marketplace_prohibited: true,
      restriction_policy_text: sentence ? collapseWs(sentence) : collapseWs(text).slice(0, 400),
      risk_level: 'RED_BLOCKED',
    }
  }
  if (/MAP|authorized reseller only|internet sales policy/i.test(text)) {
    return {
      marketplace_prohibited: false,
      restriction_policy_text: sentence ? collapseWs(sentence) : null,
      risk_level: 'YELLOW_AUDIT',
    }
  }
  return {
    marketplace_prohibited: false,
    restriction_policy_text: null,
    risk_level: 'GREEN_CLEAR',
  }
}

/**
 * @param {string} htmlOrPlain
 */
export function extractSkuFromLabels(htmlOrPlain) {
  const raw = String(htmlOrPlain ?? '')
  const plain = raw.includes('<') ? raw.replace(/<[^>]+>/g, ' ') : raw
  const m = plain.match(SKU_LABEL_RE)
  if (m) return m[1].replace(/\D/g, '')

  const classSku = raw.match(/class="[^"]*skuValue[^"]*"[^>]*>\s*([0-9]{5,7})\b/i)
  if (classSku) return classSku[1]

  const lblSku = raw.match(/(?:lbl|lit)?Sku[^>]*>\s*([0-9]{5,7})\b/i)
  if (lblSku) return lblSku[1]

  const stockNo = raw.match(/Stock\s*No\.?\s*:?\s*([0-9]{5,7})\b/i)
  if (stockNo) return stockNo[1]

  return ''
}

/**
 * @param {string} html
 */
export function extractUpcFromPlain(html) {
  const plain = html.replace(/<[^>]+>/g, ' ')
  const labeled = valueAfterLabel(plain, 'UPC').replace(/\D/g, '')
  if (labeled.length === 11) return `0${labeled}`
  if (labeled.length === 12) return labeled
  const hit = plain.match(UPC_RE)
  if (hit) return normalizeUpcDigits(hit[1])
  return ''
}

/**
 * Prefer the UPC that matches the active search when multiple appear on a page.
 * @param {string} html
 * @param {string} [targetUpc]
 */
export function extractUpcForTarget(html, targetUpc) {
  const plain = html.replace(/<[^>]+>/g, ' ')
  const target = normalizeUpcDigits(targetUpc ?? '')
  const labeled = extractUpcFromPlain(html)
  if (target && labeled === target) return labeled

  const all = []
  const re = /\b([0-9]{12})\b/g
  let m
  while ((m = re.exec(plain)) !== null) {
    const digits = normalizeUpcDigits(m[1])
    if (digits) all.push(digits)
  }
  if (target && all.includes(target)) return target
  return labeled || all[0] || ''
}

/**
 * Collect all $ amounts in order from plain text.
 * @param {string} text
 */
export function moneyAmounts(text) {
  const amounts = []
  const re = /\$\s*(\d+\.\d{2})/g
  let m
  while ((m = re.exec(text)) !== null) {
    amounts.push(Number.parseFloat(m[1]))
  }
  return amounts
}
