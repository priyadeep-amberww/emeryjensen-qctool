import { Box } from '@mui/material'
import type { QcResult } from '../../../types/qc'
import { resolveQcImageUrls } from '../../../utils/qcImages'
import { QcProductImage } from '../../compare/QcProductImage'

type SkuViewerImageTabProps = {
  result: QcResult
}

export function SkuViewerImageTab({ result }: SkuViewerImageTabProps) {
  const { sourceUrl, targetUrl } = resolveQcImageUrls(result)

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        gap: 3,
        alignItems: 'flex-start',
        py: 1,
      }}
    >
      <QcProductImage
        src={targetUrl}
        alt="Amazon product"
        label="AMAZON"
        showUrl
        size="lg"
      />
      <QcProductImage
        src={sourceUrl}
        alt="Vendor product"
        label="VENDOR"
        showUrl
        size="lg"
      />
    </Box>
  )
}
