import { useMemo } from 'react'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { QcResult } from '../../../types/qc'
import { fontFamilyMono } from '../../../theme/typography'
import { mergeFlattenedRecords } from '../../../utils/flattenRecordForTable'
import { formatUsd, tokenCostUsd } from '../../../utils/aiPricing'

type SkuViewerDetailsTabProps = {
  result: QcResult
}

export function SkuViewerDetailsTab({ result }: SkuViewerDetailsTabProps) {
  const rows = useMemo(
    () => mergeFlattenedRecords(result.targetRawExtract, result.sourceRawExtract),
    [result.targetRawExtract, result.sourceRawExtract],
  )

  const isCaptureOnly = result.captureStatus != null
  const hasTokens =
    !isCaptureOnly && (result.inputTokens != null || result.outputTokens != null)
  const cost =
    !isCaptureOnly && result.inputTokens != null && result.outputTokens != null
      ? tokenCostUsd(result.inputTokens, result.outputTokens)
      : null

  const hasAmazon = result.targetRawExtract != null
  const hasVendor = result.sourceRawExtract != null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, flex: 1 }}>
      <Paper
        sx={{
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          maxHeight: { xs: 420, lg: 480 },
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.85,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
            PARSED DATA · {rows.length} FIELD{rows.length === 1 ? '' : 'S'}
          </Typography>
          {!hasAmazon && !hasVendor && (
            <Typography sx={{ fontSize: '11px', color: 'text.secondary', mt: 0.5 }}>
              No parsed extracts available for this result.
            </Typography>
          )}
        </Box>

        <Box sx={{ overflow: 'auto', minHeight: 0, flex: 1 }}>
          {rows.length > 0 ? (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', minWidth: 140 }}>
                    FIELD
                  </TableCell>
                  <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    AMAZON
                  </TableCell>
                  <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>
                    VENDOR
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.path}>
                    <TableCell
                      sx={{
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: fontFamilyMono,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                      }}
                    >
                      {row.path}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '11px',
                        fontFamily: fontFamilyMono,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                        color: row.amazon ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {row.amazon || (hasAmazon ? '—' : 'No parsed extract')}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '11px',
                        fontFamily: fontFamilyMono,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                        color: row.vendor ? 'text.primary' : 'text.disabled',
                      }}
                    >
                      {row.vendor || (hasVendor ? '—' : 'No parsed extract')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Box>
      </Paper>

      {hasTokens && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1,
            pt: 0.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          {[
            ['Input Tokens', (result.inputTokens ?? 0).toLocaleString()],
            ['Output Tokens', (result.outputTokens ?? 0).toLocaleString()],
            ['Cost (USD)', cost != null ? formatUsd(cost) : '—'],
          ].map(([label, value]) => (
            <Box key={label}>
              <Typography
                sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}
              >
                {String(label).toUpperCase()}
              </Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, fontFamily: fontFamilyMono, mt: 0.25 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
