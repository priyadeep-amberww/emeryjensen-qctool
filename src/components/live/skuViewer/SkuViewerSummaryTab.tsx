import {
  Box,
  Chip,
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
import { useAppTheme } from '../../../theme'
import { useSettings } from '../../../context/SettingsContext'
import { useBrandAliases } from '../../../context/BrandAliasContext'
import { buildQcCoreSummary } from '../../../utils/qcCoreSummary'
import { captureStatusLabel } from '../../../services/qc/listingQcMapper'
import { QcProductImage } from '../../compare/QcProductImage'
import { QcVerdictChip } from '../../status'

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function rowBg(verdict: 'YES' | 'NO', isDark: boolean): string | undefined {
  if (verdict === 'YES') {
    return isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)'
  }
  return isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)'
}

type SkuViewerSummaryTabProps = {
  result: QcResult
}

export function SkuViewerSummaryTab({ result }: SkuViewerSummaryTabProps) {
  const { mode } = useAppTheme()
  const isDark = mode === 'dark'
  const { settings } = useSettings()
  const { aliasPairs } = useBrandAliases()
  const summary = buildQcCoreSummary(result, settings, { brandAliases: aliasPairs })
  const isCapture = result.captureStatus != null
  const backendVerdictDiffers =
    !isCapture && result.verdict != null && result.verdict !== summary.finalVerdict

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
      {isCapture && (
        <Box
          sx={{
            px: 1.25,
            py: 1,
            borderRadius: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
            CAPTURE STATUS
          </Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, mt: 0.5 }}>
            {captureStatusLabel(result.captureStatus!)}
          </Typography>
          {(result.scrapeLog?.length ?? 0) > 0 && (
            <Typography
              component="pre"
              sx={{
                fontSize: '10px',
                fontFamily: fontFamilyMono,
                mt: 1,
                mb: 0,
                whiteSpace: 'pre-wrap',
                color: 'text.secondary',
                maxHeight: 160,
                overflow: 'auto',
              }}
            >
              {result.scrapeLog!.join('\n')}
            </Typography>
          )}
        </Box>
      )}

      <Paper
        sx={{
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 0.85,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
            QC SUMMARY · 6 CORE CHECKS
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
              FINAL QC
            </Typography>
            <QcVerdictChip
              verdict={result.verdict ?? summary.finalVerdict}
              density="default"
            />
          </Box>
        </Box>

        <Box sx={{ overflow: 'auto', minHeight: 0 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', width: 120 }}>
                  CHECK
                </TableCell>
                <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>AMAZON</TableCell>
                <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>VENDOR</TableCell>
                <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', width: 72 }}>
                  VERDICT
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.rows.map((row) => {
                const isImage = row.key === 'image'
                return (
                  <TableRow key={row.key} sx={{ bgcolor: rowBg(row.verdict, isDark) }}>
                    <TableCell sx={{ fontSize: '11px', fontWeight: 700, verticalAlign: 'top' }}>
                      {row.label}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '11px',
                        fontFamily: fontFamilyMono,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                        maxWidth: 220,
                      }}
                    >
                      {isImage && looksLikeUrl(row.amazonValue) ? (
                        <QcProductImage src={row.amazonValue} alt="Amazon image" size="sm" />
                      ) : (
                        row.amazonValue
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: '11px',
                        fontFamily: fontFamilyMono,
                        verticalAlign: 'top',
                        wordBreak: 'break-word',
                        maxWidth: 220,
                      }}
                    >
                      {isImage && looksLikeUrl(row.vendorValue) ? (
                        <QcProductImage src={row.vendorValue} alt="Vendor image" size="sm" />
                      ) : (
                        row.vendorValue
                      )}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Chip
                        size="small"
                        label={row.verdict}
                        color={row.verdict === 'YES' ? 'success' : 'error'}
                        sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>

        {backendVerdictDiffers && (
          <Box sx={{ px: 1.5, py: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '10px', color: 'text.secondary' }}>
              Backend verdict ({result.verdict}) differs — SUMMARY uses core-six checks only.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
