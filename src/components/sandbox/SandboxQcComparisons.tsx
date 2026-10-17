import { Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material'
import { QcProductImage } from '../compare'
import type { SandboxComparison, SandboxCompareOutcome } from '../../data/sandboxQc'

function outcomeColor(o: SandboxCompareOutcome): 'success' | 'error' | 'warning' {
  if (o === 'MATCH') return 'success'
  if (o === 'MISMATCH') return 'error'
  return 'warning'
}

function outcomeLabel(o: SandboxCompareOutcome): string {
  if (o === 'MATCH') return 'Match'
  if (o === 'MISMATCH') return 'No match'
  return 'Review'
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

function ComparisonValueCell({ value }: { value: string }) {
  if (looksLikeUrl(value)) {
    return (
      <Box sx={{ maxWidth: 168 }}>
        <QcProductImage src={value} alt="Product" showUrl size="sm" />
      </Box>
    )
  }
  return <>{value}</>
}

function rowBg(outcome: SandboxCompareOutcome, isDark: boolean): string | undefined {
  if (outcome === 'MATCH') {
    return isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)'
  }
  if (outcome === 'MISMATCH') {
    return isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)'
  }
  return isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.1)'
}

type SandboxQcComparisonsProps = {
  comparisons: SandboxComparison[]
  isDark: boolean
}

export function SandboxQcComparisons({ comparisons, isDark }: SandboxQcComparisonsProps) {
  const summary = comparisons.reduce(
    (acc, c) => {
      if (c.outcome === 'MATCH') acc.match += 1
      else if (c.outcome === 'MISMATCH') acc.mismatch += 1
      else acc.review += 1
      return acc
    },
    { match: 0, mismatch: 0, review: 0 },
  )

  return (
    <Paper
      sx={{
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        maxHeight: { xs: 480, lg: 420 },
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.85,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
          QC COMPARISONS · {comparisons.length} CHECKS
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <Chip
            size="small"
            label={`Match ${summary.match}`}
            color="success"
            sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
          />
          <Chip
            size="small"
            label={`No match ${summary.mismatch}`}
            color="error"
            sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
          />
          <Chip
            size="small"
            label={`Review ${summary.review}`}
            color="warning"
            sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
          />
        </Box>
      </Box>
      <Box sx={{ overflow: 'auto', minHeight: 0, flex: 1 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', width: 108 }}>
                CHECK
              </TableCell>
              <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>VENDOR</TableCell>
              <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em' }}>ASIN</TableCell>
              <TableCell sx={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', width: 108 }}>
                RESULT
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comparisons.map((field) => (
              <TableRow key={field.key} sx={{ bgcolor: rowBg(field.outcome, isDark) }}>
                <TableCell sx={{ fontSize: '11px', fontWeight: 700, verticalAlign: 'top' }}>{field.label}</TableCell>
                <TableCell
                  sx={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                    maxWidth: 200,
                  }}
                >
                  <ComparisonValueCell value={field.sourceValue} />
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    verticalAlign: 'top',
                    wordBreak: 'break-word',
                    maxWidth: 200,
                  }}
                >
                  <ComparisonValueCell value={field.targetValue} />
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Chip
                    size="small"
                    label={outcomeLabel(field.outcome)}
                    color={outcomeColor(field.outcome)}
                    sx={{ height: 22, fontSize: '10px', fontWeight: 700, borderRadius: 0.5 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  )
}
