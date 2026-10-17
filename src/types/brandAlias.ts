/** One saved Amazon ↔ vendor brand pair that counts as a QC brand match. */
export type BrandAlias = {
  id: string
  amazonBrand: string
  vendorBrand: string
}

export type BrandAliasPair = Pick<BrandAlias, 'amazonBrand' | 'vendorBrand'>
