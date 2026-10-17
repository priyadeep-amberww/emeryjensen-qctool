import { useMemo, useState } from 'react'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { PageFrame } from '../components/layout/PageFrame'
import { ConfirmDialog } from '../components/confirm'
import { useAiUsage } from '../context/AiUsageContext'
import { useBatchRun } from '../context/BatchDemoContext'
import { formatUsd, HAIKU_INPUT_PER_M, HAIKU_OUTPUT_PER_M, tokenCostUsd } from '../utils/aiPricing'
import { fontFamilyMono } from '../theme/typography'

function CostMetric({
  label,
  value,
  valueSize = '18px',
}: {
  label: string
  value: string
  valueSize?: string
}) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
        {label.toUpperCase()}
      </Typography>
      <Typography
        sx={{
          fontSize: valueSize,
          fontWeight: 700,
          mt: 0.35,
          fontFamily: fontFamilyMono,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export function AiCostsPage() {
  const { completedCount, aiInputTokens, aiOutputTokens, total, running } = useBatchRun()
  const { allTimeInputTokens, allTimeOutputTokens, allTimeCostUsd, resetAllTimeUsage } = useAiUsage()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const inputTokens = aiInputTokens
  const outputTokens = aiOutputTokens
  const batchCost = useMemo(
    () => tokenCostUsd(inputTokens, outputTokens),
    [inputTokens, outputTokens],
  )

  const skuCount = completedCount
  const perSku = skuCount > 0 ? batchCost / skuCount : 0
  const per1000 = perSku * 1000
  const per10000 = perSku * 10000

  return (
    <PageFrame
      title="AI costs"
      subtitle={`Claude Haiku 5.5 · $${HAIKU_INPUT_PER_M}/M input · $${HAIKU_OUTPUT_PER_M}/M output`}
      actions={
        <Typography sx={{ fontSize: '11px', color: running ? 'primary.main' : 'text.secondary', fontWeight: 600 }}>
          {skuCount} / {total} SKUs in current run
        </Typography>
      }
    >
      <Paper sx={{ p: 2, borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
          LIVE RUN DETAILS
        </Typography>
        <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.35, mb: 1.5 }}>
          Current QC batch usage from completed SKUs. Totals update as each AI comparison finishes.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
            gap: 1.5,
          }}
        >
          <CostMetric label="Input tokens" value={inputTokens.toLocaleString()} />
          <CostMetric label="Output tokens" value={outputTokens.toLocaleString()} />
          <CostMetric label="Cost incurred (USD)" value={formatUsd(batchCost)} valueSize="20px" />
          <CostMetric
            label="Est. ×1,000 SKUs (USD)"
            value={skuCount > 0 ? formatUsd(per1000) : '—'}
          />
          <CostMetric
            label="Est. ×10,000 SKUs (USD)"
            value={skuCount > 0 ? formatUsd(per10000) : '—'}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 0.5, border: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
            mb: 1.5,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
              LIFETIME AI COSTS
            </Typography>
            <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.35 }}>
              Cumulative AI tokens recorded by the QC engine (Live Output batch + Sandbox). Updates live as
              SKUs finish.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => setResetConfirmOpen(true)}
            sx={{ height: 30, fontSize: '11px', fontWeight: 600, borderRadius: 0.5, flexShrink: 0 }}
          >
            Reset lifetime costs
          </Button>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', color: 'text.secondary' }}>
            LIFETIME AI COSTS INCURRED (USD)
          </Typography>
          <Typography
            sx={{
              fontSize: '28px',
              fontWeight: 700,
              mt: 0.35,
              fontFamily: fontFamilyMono,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatUsd(allTimeCostUsd)}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
          <CostMetric label="Lifetime input tokens" value={allTimeInputTokens.toLocaleString()} valueSize="16px" />
          <CostMetric label="Lifetime output tokens" value={allTimeOutputTokens.toLocaleString()} valueSize="16px" />
        </Box>
      </Paper>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset lifetime AI costs?"
        message="This permanently clears all persisted lifetime token totals and recalculates lifetime cost to $0.00. The current live run is not changed."
        confirmLabel="Reset lifetime data"
        cancelLabel="Keep lifetime totals"
        confirmColor="error"
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={resetAllTimeUsage}
      >
        <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 0.5, fontSize: '11px', py: 0.25 }}>
          Warning: lifetime AI cost and token history will be erased. This cannot be undone and is only for
          resetting your visibility totals — it does not affect API billing with your provider.
        </Alert>
      </ConfirmDialog>
    </PageFrame>
  )
}

