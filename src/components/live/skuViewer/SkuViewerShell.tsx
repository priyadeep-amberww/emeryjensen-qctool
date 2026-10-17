import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import type { QcResult } from '../../../types/qc'
import { fontFamilyMono } from '../../../theme/typography'
import { qcResultIdentityValue } from '../../../utils/qcCoreSummary'
import { CaptureStatusChip, QcVerdictChip } from '../../status'
import { SkuViewerSummaryTab } from './SkuViewerSummaryTab'
import { SkuViewerDetailsTab } from './SkuViewerDetailsTab'
import { SkuViewerImageTab } from './SkuViewerImageTab'
import { SkuViewerRawScrapeTab } from './SkuViewerRawScrapeTab'

const TAB_LABELS = ['SUMMARY', 'DETAILS', 'IMAGE', 'RAW SCRAPE'] as const
type SkuViewerTab = (typeof TAB_LABELS)[number]

type SkuViewerShellProps = {
  result: QcResult
}

export function SkuViewerShell({ result }: SkuViewerShellProps) {
  const [tab, setTab] = useState<SkuViewerTab>('SUMMARY')
  const asin = qcResultIdentityValue(result, 'listing_id', 'asin')
  const sku = qcResultIdentityValue(result, 'sku', 'part_sku')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}>
            AMAZON ASIN
          </Typography>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: fontFamilyMono,
              wordBreak: 'break-all',
            }}
          >
            {asin}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0, textAlign: { xs: 'left', sm: 'right' } }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}>
            VENDOR SKU
          </Typography>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: fontFamilyMono,
              wordBreak: 'break-all',
            }}
          >
            {sku}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', py: 0.75 }}>
        {result.captureStatus ? (
          <CaptureStatusChip status={result.captureStatus} density="default" />
        ) : result.verdict ? (
          <QcVerdictChip verdict={result.verdict} density="compact" />
        ) : null}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, next: SkuViewerTab) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 36,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          '& .MuiTab-root': {
            minHeight: 36,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            py: 0.75,
          },
        }}
      >
        {TAB_LABELS.map((label) => (
          <Tab key={label} value={label} label={label} />
        ))}
      </Tabs>

      <Box sx={{ pt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {tab === 'SUMMARY' && <SkuViewerSummaryTab result={result} />}
        {tab === 'DETAILS' && <SkuViewerDetailsTab result={result} />}
        {tab === 'IMAGE' && <SkuViewerImageTab result={result} />}
        {tab === 'RAW SCRAPE' && <SkuViewerRawScrapeTab result={result} />}
      </Box>
    </Box>
  )
}
