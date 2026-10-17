import { Box, Typography } from '@mui/material'
import type { QcResult } from '../../../types/qc'
import { qcResultIdentityValue } from '../../../utils/qcCoreSummary'
import { RawScrapeComparePair } from '../../sandbox/RawScrapeComparePair'

type SkuViewerRawScrapeTabProps = {
  result: QcResult
}

export function SkuViewerRawScrapeTab({ result }: SkuViewerRawScrapeTabProps) {
  const asin = qcResultIdentityValue(result, 'listing_id', 'asin')
  const sku = qcResultIdentityValue(result, 'sku', 'part_sku')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
        RAW SCRAPE DATA
      </Typography>
      <RawScrapeComparePair
        amazonData={result.targetRawExtract}
        vendorData={result.sourceRawExtract}
        asin={asin !== '—' ? asin : undefined}
        sku={sku !== '—' ? sku : undefined}
        maxHeight={{ xs: 360, lg: 520 }}
        hideWhenEmpty={false}
        amazonEmptyMessage="No SP-API scrape for this SKU"
        vendorEmptyMessage="No vendor scrape for this SKU"
      />
    </Box>
  )
}
