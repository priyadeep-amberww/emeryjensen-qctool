import {
  filteredBulletPoints,
  flattenFilteredAmazonAttributes,
} from './amazonAttributeFilter.mjs'

export function extractDescriptionTexts(vendorExtract, catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}
  const attributes = root.attributes && typeof root.attributes === 'object' ? root.attributes : {}
  const amazonText = filteredBulletPoints(attributes).join(' | ')

  const vendorTitle =
    vendorExtract?.identity?.title != null ? String(vendorExtract.identity.title).trim() : ''

  return { vendorText: vendorTitle, amazonText }
}

export function extractSpecificationTexts(vendorExtract, catalogJson) {
  const root = catalogJson && typeof catalogJson === 'object' ? catalogJson : {}
  const attributes = root.attributes && typeof root.attributes === 'object' ? root.attributes : {}
  const amazonText = flattenFilteredAmazonAttributes(attributes).join(' | ')

  const id = vendorExtract?.identity ?? {}
  const commercials = vendorExtract?.commercials ?? {}
  const logistics =
    vendorExtract?.logistics && typeof vendorExtract.logistics === 'object'
      ? vendorExtract.logistics
      : {}
  const chunks = []
  if (id.mfg_part_number) chunks.push(`mfg_part_number: ${id.mfg_part_number}`)
  if (id.vendor?.name) chunks.push(`vendor_name: ${id.vendor.name}`)
  if (commercials.wholesale_cost != null) {
    chunks.push(`wholesale_cost: ${commercials.wholesale_cost}`)
  }
  if (commercials.case_cost != null) chunks.push(`case_cost: ${commercials.case_cost}`)
  for (const [key, value] of Object.entries(logistics)) {
    if (value != null && value !== '') chunks.push(`${key}: ${String(value)}`)
  }
  if (vendorExtract?.inventory) {
    for (const [key, value] of Object.entries(vendorExtract.inventory)) {
      if (value != null && value !== '') chunks.push(`${key}: ${String(value)}`)
    }
  }
  if (vendorExtract?.compliance) {
    for (const [key, value] of Object.entries(vendorExtract.compliance)) {
      if (value != null && value !== '') chunks.push(`${key}: ${String(value)}`)
    }
  }
  return { vendorText: chunks.join(' | '), amazonText }
}
