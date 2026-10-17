/** Six core QC checks shown on Live Output SKU viewer SUMMARY tab. */
export const QC_CORE_COMPARISON_KEYS = [
  'title',
  'brand',
  'pack',
  'model',
  'upc',
  'image',
] as const

export type QcCoreComparisonKey = (typeof QC_CORE_COMPARISON_KEYS)[number]

export type QcCoreComparisonDef = {
  key: QcCoreComparisonKey
  /** Uppercase label for SUMMARY table rows */
  label: string
}

export const QC_CORE_COMPARISONS: readonly QcCoreComparisonDef[] = [
  { key: 'title', label: 'TITLE' },
  { key: 'brand', label: 'BRAND-NAME' },
  { key: 'pack', label: 'PACK-SIZE' },
  { key: 'model', label: 'MODEL-NUMBER' },
  { key: 'upc', label: 'UPC' },
  { key: 'image', label: 'IMAGE' },
]
