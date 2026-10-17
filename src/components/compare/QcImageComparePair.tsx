import { memo } from 'react'
import { Box } from '@mui/material'
import { QcProductImage, type QcProductImageSize } from './QcProductImage'

export type QcImageComparePairProps = {
  sourceUrl?: string | null
  targetUrl?: string | null
  sourceLabel?: string
  targetLabel?: string
  showUrl?: boolean
  size?: QcProductImageSize
}

/** Side-by-side Vendor / Amazon images — sized to content, no stretched frames. */
export const QcImageComparePair = memo(function QcImageComparePair({
  sourceUrl,
  targetUrl,
  sourceLabel = 'Vendor',
  targetLabel = 'Amazon',
  showUrl = true,
  size = 'md',
}: QcImageComparePairProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 2,
        minWidth: 0,
      }}
    >
      <QcProductImage
        src={sourceUrl}
        alt={`${sourceLabel} product`}
        label={sourceLabel}
        showUrl={showUrl}
        size={size}
      />
      <QcProductImage
        src={targetUrl}
        alt={`${targetLabel} product`}
        label={targetLabel}
        showUrl={showUrl}
        size={size}
      />
    </Box>
  )
})
