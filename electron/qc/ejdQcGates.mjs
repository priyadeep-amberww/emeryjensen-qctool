function padUpc(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 11) return `0${digits}`
  if (digits.length === 12) return digits
  return digits
}

function amazonUpcs(catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}
  const blocks = Array.isArray(root.identifiers) ? root.identifiers : []
  const out = []
  for (const block of blocks) {
    const ids = block?.identifiers ?? []
    for (const id of ids) {
      if (/UPC|EAN|GTIN/i.test(String(id?.identifierType ?? ''))) {
        out.push(padUpc(id.identifier))
      }
    }
  }
  return out
}

function row(key, label, sourceValue, targetValue) {
  return { key, label, sourceValue: String(sourceValue), targetValue: String(targetValue) }
}

/**
 * Pre-QC gates: portal presence, identifier alignment, marketplace compliance only.
 * Profit, inventory, and pack-vs-order-multiple are not part of listing QC.
 *
 * @param {{ vendorExtract: any, catalogJson: any, captureStatus: string, asin: string }} input
 */
export async function evaluateEjdQcGates(input) {
  const log = []
  const comparisons = []
  let verdict = 'PASS'

  const fail = (message) => {
    verdict = 'FAIL'
    log.push(message)
  }

  if (input.captureStatus === 'not_on_portal') {
    fail('Gate: UPC is not on the EJD portal')
    comparisons.push(row('gate1', 'EJD catalog', 'not on portal', input.asin))
    return { verdict, comparisons, log }
  }
  if (input.captureStatus === 'bad_parse' || !input.vendorExtract) {
    log.push('Gate: vendor parse incomplete — manual review')
    comparisons.push(row('gate1', 'EJD catalog', 'bad parse', input.asin))
    return { verdict: 'MANUAL_REVIEW', comparisons, log }
  }

  const vendor = input.vendorExtract
  const vendorUpc = padUpc(vendor.identity?.upc)
  const amzUpcs = amazonUpcs(input.catalogJson)
  const upcMatch = amzUpcs.includes(vendorUpc)
  comparisons.push(row('gate1', 'UPC match', vendorUpc || '—', amzUpcs.join(', ') || '—'))
  if (!input.catalogJson || !upcMatch) {
    fail('Gate: vendor UPC does not match Amazon identifiers')
    return { verdict, comparisons, log }
  }
  log.push('Gate pass: EJD UPC matches Amazon')

  const risk = vendor.compliance?.risk_level ?? 'UNKNOWN'
  comparisons.push(row('gate3', 'Compliance', risk, vendor.compliance?.restriction_policy_text ?? '—'))
  if (risk === 'RED_BLOCKED') {
    fail('Gate: marketplace sale prohibited (compliance RED_BLOCKED)')
    return { verdict, comparisons, log }
  }
  log.push(`Gate pass: compliance ${risk}`)

  return { verdict: 'PASS', comparisons, log }
}
