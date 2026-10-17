import type { BrandAliasPair } from '../types/brandAlias'

/** True only when an exact saved pair matches vendor (source) and Amazon (target) brands. */
export function isBrandAliasMatch(
  vendorBrand: string,
  amazonBrand: string,
  aliases: readonly BrandAliasPair[],
): boolean {
  const vendor = vendorBrand.trim()
  const amazon = amazonBrand.trim()
  if (!vendor || !amazon || aliases.length === 0) return false
  return aliases.some(
    (row) => row.vendorBrand.trim() === vendor && row.amazonBrand.trim() === amazon,
  )
}
