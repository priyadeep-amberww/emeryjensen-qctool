import { memo } from 'react'
import { RawExtractPanel } from './RawExtractPanel'

export type RawVendorWebsiteExtractProps = {
  data: unknown
  sku?: string
  maxHeight?: number | { xs?: number; md?: number; lg?: number }
  emptyMessage?: string
}

/** Complete raw payload fetched from the vendor website source. */
export const RawVendorWebsiteExtract = memo(function RawVendorWebsiteExtract({
  data,
  sku,
  maxHeight,
  emptyMessage = 'No vendor scrape data',
}: RawVendorWebsiteExtractProps) {
  return (
    <RawExtractPanel
      title="RAW VENDOR WEBSITE EXTRACT"
      subtitle={sku ? `Vendor source · ${sku}` : 'Vendor website product source'}
      data={data}
      emptyMessage={emptyMessage}
      maxHeight={maxHeight}
    />
  )
})
