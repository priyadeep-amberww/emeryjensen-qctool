import { memo } from 'react'
import { RawExtractPanel } from './RawExtractPanel'

export type RawAsinExtractProps = {
  data: unknown
  asin?: string
  maxHeight?: number | { xs?: number; md?: number; lg?: number }
  emptyMessage?: string
}

/** Complete raw payload fetched from the ASIN / Amazon listing source. */
export const RawAsinExtract = memo(function RawAsinExtract({
  data,
  asin,
  maxHeight,
  emptyMessage = 'No Amazon / ASIN scrape data',
}: RawAsinExtractProps) {
  return (
    <RawExtractPanel
      title="RAW ASIN EXTRACT"
      subtitle={asin ? `Amazon source · ${asin}` : 'Amazon / ASIN listing source'}
      data={data}
      emptyMessage={emptyMessage}
      maxHeight={maxHeight}
    />
  )
})
